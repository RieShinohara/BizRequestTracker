from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import Category, Request, TemplateItem
from app.schemas import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    TemplateItemIO,
    TemplateItemsReplace,
)

router = APIRouter(prefix="/api/categories", tags=["categories"])

DUPLICATE = "同じ名前のカテゴリーがすでにあります"
IN_USE = "このカテゴリーを使っている依頼があるため、削除できません"


def _request_count(db: Session, category_id: int) -> int:
    return db.scalar(
        select(func.count()).select_from(Request).where(Request.category_id == category_id)
    )


def _out(db: Session, category: Category) -> CategoryOut:
    return CategoryOut(
        id=category.id, name=category.name, request_count=_request_count(db, category.id)
    )


def _get_or_404(db: Session, category_id: int) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "カテゴリーが見つかりません")
    return category


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    count = func.count(Request.id)
    rows = db.execute(
        select(Category.id, Category.name, count.label("request_count"))
        .outerjoin(Request, Request.category_id == Category.id)
        .group_by(Category.id, Category.name)
        .order_by(Category.id)
    )
    return [CategoryOut(id=r.id, name=r.name, request_count=r.request_count) for r in rows]


@router.get("/{category_id}/template-items", response_model=list[TemplateItemIO])
def list_template_items(category_id: int, db: Session = Depends(get_db)):
    category = _get_or_404(db, category_id)
    return category.template_items  # テンプレートの順番（sort_order 順）


@router.put("/{category_id}/template-items", response_model=list[TemplateItemIO])
def replace_template_items(
    category_id: int, body: TemplateItemsReplace, db: Session = Depends(get_db)
):
    """送られた一覧を、そのままテンプレートにする（追加・編集・削除を、一度に反映）。"""
    category = _get_or_404(db, category_id)
    category.template_items = [
        TemplateItem(name=item.name, sort_order=position)
        for position, item in enumerate(body.items, start=1)
    ]
    db.commit()
    return category.template_items


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    category = Category(name=body.name)
    db.add(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, DUPLICATE) from None
    return _out(db, category)


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, body: CategoryUpdate, db: Session = Depends(get_db)):
    category = _get_or_404(db, category_id)
    category.name = body.name
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, DUPLICATE) from None
    return _out(db, category)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = _get_or_404(db, category_id)
    if _request_count(db, category_id) > 0:
        raise HTTPException(status.HTTP_409_CONFLICT, IN_USE)
    try:
        db.delete(category)  # テンプレート項目は、DB が一緒に消す（CASCADE）
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, IN_USE) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)
