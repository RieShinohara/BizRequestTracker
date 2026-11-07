from typing import get_args

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import Request
from app.schemas import Status

router = APIRouter(prefix="/api", tags=["summary"])


class SummaryOut(BaseModel):
    status_counts: dict[str, int]
    urgent_count: int


@router.get("/summary", response_model=SummaryOut)
def get_summary(db: Session = Depends(get_db)):
    """画面上部の件数。検索・絞り込みの影響は受けない（画面全体の件数）。"""
    rows = db.execute(
        select(Request.status, func.count())
        .where(Request.archived.is_(False))  # アーカイブ中は数えない
        .group_by(Request.status)
    )
    found = dict(rows.all())
    # 件数が0のステータスも、0 として返す（画面が、キーの有無を気にしなくてよいように）
    status_counts = {status: found.get(status, 0) for status in get_args(Status)}

    urgent_count = db.scalar(
        select(func.count()).where(
            Request.priority == "急ぎ",
            Request.archived.is_(False),
            Request.status != "完了",
        )
    )
    return SummaryOut(status_counts=status_counts, urgent_count=urgent_count)
