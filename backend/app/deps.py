from collections.abc import Iterator

from sqlalchemy.orm import Session

from app.db import SessionLocal


def get_db() -> Iterator[Session]:
    """窓口（API）ごとに、DB の Session を1つ貸し出し、終わったら閉じる。"""
    with SessionLocal() as session:
        yield session
