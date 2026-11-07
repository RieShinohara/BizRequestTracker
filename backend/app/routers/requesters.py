from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import Requester
from app.schemas import RequesterCreate, RequesterOut, RequesterUpdate

router = APIRouter(prefix="/api/requesters", tags=["requesters"])

DUPLICATE = "同じ名前の依頼者がすでにあります"


@router.get("", response_model=list[RequesterOut])
def list_requesters(db: Session = Depends(get_db)):
    return db.scalars(select(Requester).order_by(Requester.name)).all()


@router.post("", response_model=RequesterOut, status_code=status.HTTP_201_CREATED)
def create_requester(body: RequesterCreate, db: Session = Depends(get_db)):
    requester = Requester(name=body.name, extension=body.extension)
    db.add(requester)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, DUPLICATE) from None
    return requester


@router.patch("/{requester_id}", response_model=RequesterOut)
def update_requester(requester_id: int, body: RequesterUpdate, db: Session = Depends(get_db)):
    requester = db.get(Requester, requester_id)
    if requester is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "依頼者が見つかりません")
    # 送られた項目だけ変える（extension に null を送ると、内線番号を消せる）
    for field in body.model_fields_set:
        setattr(requester, field, getattr(body, field))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, DUPLICATE) from None
    return requester
