from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi import status as status_module  # 引数名 status と重なる関数の中で使う
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.business_days import due_level
from app.deps import get_db
from app.models import Category, ChecklistItem, Request, Requester
from app.schemas import (
    CategoryBrief,
    ChecklistItemOut,
    IdName,
    OrderBody,
    RequestCreate,
    RequesterBrief,
    RequestListItem,
    RequestOut,
    RequestUpdate,
    Status,
)

router = APIRouter(prefix="/api/requests", tags=["requests"])

NOT_ARCHIVED = "アーカイブ中の依頼だけ削除できます"
ORDER_STALE = "一覧が古くなっています。開き直してください"


def _to_out(request: Request) -> RequestOut:
    items = request.checklist_items
    return RequestOut(
        id=request.id,
        title=request.title,
        description=request.description,
        requester=RequesterBrief(
            id=request.requester.id,
            name=request.requester.name,
            extension=request.requester.extension,
        ),
        category=CategoryBrief(id=request.category.id, name=request.category.name),
        received_on=request.received_on,
        due_on=request.due_on,
        status=request.status,
        priority=request.priority,
        confirm_to=request.confirm_to,
        qms=request.qms,
        archived=request.archived,
        checklist_done=sum(1 for item in items if item.done),
        checklist_total=len(items),
        due_level=due_level(request.due_on, request.status, request.archived),
        checklist_items=[ChecklistItemOut(name=i.name, done=i.done) for i in items],
    )


def _to_list_item(request: Request) -> RequestListItem:
    items = request.checklist_items
    return RequestListItem(
        id=request.id,
        title=request.title,
        requester=IdName(id=request.requester.id, name=request.requester.name),
        category=IdName(id=request.category.id, name=request.category.name),
        status=request.status,
        priority=request.priority,
        confirm_to=request.confirm_to,
        due_on=request.due_on,
        qms=request.qms,
        archived=request.archived,
        checklist_done=sum(1 for item in items if item.done),
        checklist_total=len(items),
        due_level=due_level(request.due_on, request.status, request.archived),
    )


def _rank(column, order: list[str]):
    """文字の値を、決まった順番（上から）の番号に直す。五十音順ではなく、この順に並べるため。"""
    return case({value: position for position, value in enumerate(order)}, value=column)


# 並び替えの順番（docs/api-design.md）。同じ値どうしは、手動の並びのまま
PRIORITY_ORDER = ["急ぎ", "高", "中", "低"]
STATUS_ORDER = ["未着手", "作業中", "確認待ち", "完了", "ペンディング"]


def _escape_like(text: str) -> str:
    """検索の文字に含まれる % と _ を、ふつうの文字として扱う（LIKE の特別な文字を無効にする）。"""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("", response_model=list[RequestListItem])
def list_requests(
    q: str | None = None,
    qms: bool | None = None,
    category_id: int | None = None,
    status: Status | None = None,
    include_archived: bool = False,
    sort: Literal["priority", "due_on", "status"] | None = None,
    db: Session = Depends(get_db),
):
    """依頼の一覧。検索・絞り込み・並び替えは、サーバー側で行う。条件はすべて省略できる。"""
    query = select(Request).options(
        joinedload(Request.requester),
        joinedload(Request.category),
        selectinload(Request.checklist_items),
    )
    if not include_archived:
        query = query.where(Request.archived.is_(False))
    if q and q.strip():
        pattern = f"%{_escape_like(q.strip())}%"
        query = query.where(
            or_(
                Request.title.like(pattern, escape="\\"),
                Request.description.like(pattern, escape="\\"),
                Request.confirm_to.like(pattern, escape="\\"),
                Request.requester.has(Requester.name.like(pattern, escape="\\")),
            )
        )
    if qms:  # true のときだけ、QMS の依頼に絞る（false や省略は、絞らない）
        query = query.where(Request.qms.is_(True))
    if category_id is not None:
        query = query.where(Request.category_id == category_id)
    if status is not None:
        query = query.where(Request.status == status)

    # sort なし＝手動の並び。sort ありのときも、同じ値どうしは手動の並びのまま
    if sort == "priority":
        query = query.order_by(_rank(Request.priority, PRIORITY_ORDER))
    elif sort == "due_on":
        query = query.order_by(Request.due_on)
    elif sort == "status":
        query = query.order_by(_rank(Request.status, STATUS_ORDER))
    query = query.order_by(Request.sort_order, Request.id)

    return [_to_list_item(r) for r in db.scalars(query).all()]


@router.put("/order", status_code=status_module.HTTP_204_NO_CONTENT)
def save_order(body: OrderBody, db: Session = Depends(get_db)):
    """手動の並びを保存する。ids は、アーカイブ中を除く全依頼の番号を、並べたもの。"""
    active = db.scalars(select(Request).where(Request.archived.is_(False))).all()
    by_id = {r.id: r for r in active}
    # 過不足・重複があるとき（別の画面で、依頼が増減したなど）は、何も変えずに 409
    if len(body.ids) != len(set(body.ids)) or set(body.ids) != set(by_id):
        raise HTTPException(status_module.HTTP_409_CONFLICT, ORDER_STALE)
    for position, request_id in enumerate(body.ids, start=1):
        by_id[request_id].sort_order = position
    db.commit()
    return Response(status_code=status_module.HTTP_204_NO_CONTENT)


def _get_or_404(db: Session, request_id: int) -> Request:
    request = db.get(Request, request_id)
    if request is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "依頼が見つかりません")
    return request


def _check_references(db: Session, requester_id: int | None, category_id: int | None) -> None:
    """依頼者・カテゴリーの番号が、登録済みか確かめる（なければ 422）。"""
    if requester_id is not None and db.get(Requester, requester_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "依頼者が見つかりません")
    if category_id is not None and db.get(Category, category_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "カテゴリーが見つかりません")


def _checklist(items) -> list[ChecklistItem]:
    return [
        ChecklistItem(name=item.name, done=item.done, sort_order=position)
        for position, item in enumerate(items, start=1)
    ]


@router.post("", response_model=RequestOut, status_code=status.HTTP_201_CREATED)
def create_request(body: RequestCreate, db: Session = Depends(get_db)):
    _check_references(db, body.requester_id, body.category_id)
    # 新しい依頼は、手動の並びのいちばん上（今ある最小の番号より、1つ小さい番号）
    top = db.scalar(select(func.min(Request.sort_order)))
    request = Request(
        title=body.title,
        description=body.description,
        requester_id=body.requester_id,
        category_id=body.category_id,
        due_on=body.due_on,
        status=body.status,
        priority=body.priority,
        confirm_to=body.confirm_to,
        qms=body.qms,
        sort_order=1 if top is None else top - 1,
        checklist_items=_checklist(body.checklist_items),
    )
    if body.received_on is not None:  # 省略すると、モデルの初期値（今日）
        request.received_on = body.received_on
    db.add(request)
    db.commit()
    return _to_out(request)


@router.get("/{request_id}", response_model=RequestOut)
def get_request(request_id: int, db: Session = Depends(get_db)):
    return _to_out(_get_or_404(db, request_id))


@router.patch("/{request_id}", response_model=RequestOut)
def update_request(request_id: int, body: RequestUpdate, db: Session = Depends(get_db)):
    request = _get_or_404(db, request_id)
    _check_references(db, body.requester_id, body.category_id)
    # 送った項目だけ変える。confirm_to は、ステータスが変わっても消さない
    for field in body.model_fields_set:
        if field == "checklist_items":
            request.checklist_items = _checklist(body.checklist_items)  # 全体を入れ替え
        else:
            setattr(request, field, getattr(body, field))
    db.commit()
    return _to_out(request)


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_request(request_id: int, db: Session = Depends(get_db)):
    request = _get_or_404(db, request_id)
    if not request.archived:
        raise HTTPException(status.HTTP_409_CONFLICT, NOT_ARCHIVED)
    db.delete(request)  # チェックリストは、DB が一緒に消す（CASCADE）
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
