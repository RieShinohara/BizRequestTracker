from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import Request
from app.settings import CONFIRM_TARGET_DEFAULTS

router = APIRouter(prefix="/api", tags=["confirm-targets"])


@router.get("/confirm-targets", response_model=list[str])
def list_confirm_targets(db: Session = Depends(get_db)):
    """確認先の候補。最初の候補（設定ファイル）のあとに、過去に入力された確認先が続く。"""
    used = db.scalars(
        select(Request.confirm_to)
        .where(Request.confirm_to.is_not(None), Request.confirm_to != "")  # アーカイブ中も含む
        .group_by(Request.confirm_to)
        .order_by(func.min(Request.id))  # 最初に使われた順
    )
    targets = list(CONFIRM_TARGET_DEFAULTS)
    for name in used:
        if name not in targets:  # 同じ文字は重ねない
            targets.append(name)
    return targets
