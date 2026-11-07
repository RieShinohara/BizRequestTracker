from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import Category, ChecklistItem, Request, Requester
from app.schemas import (
    CategoryBrief,
    ChecklistItemOut,
    RequestCreate,
    RequesterBrief,
    RequestOut,
    RequestUpdate,
)

router = APIRouter(prefix="/api/requests", tags=["requests"])

NOT_ARCHIVED = "アーカイブ中の依頼だけ削除できます"


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
        checklist_items=[ChecklistItemOut(name=i.name, done=i.done) for i in items],
    )


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
