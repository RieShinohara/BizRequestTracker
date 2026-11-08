"""初期データ（7つのカテゴリーと作業テンプレート）のテスト。

マイグレーション 0002 が入れる。内容は docs/functional-requirements.md の 7。
"""

import os
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import URL, create_engine, select, text
from sqlalchemy.orm import Session

from app.models import Category, TemplateItem

SEED_DB = "biz_request_tracker_seed_test"
ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"

# カテゴリーの名前と、テンプレートの項目数（docs/functional-requirements.md の 7）
EXPECTED_COUNTS = {
    "HP": 8,
    "動画": 12,
    "研究倫理委員会": 5,
    "通関": 11,
    "取扱説明書": 9,
    "AIアカウント発行": 6,
    "引っ越し": 6,
}


def _template(session: Session, name: str) -> list[str]:
    category = session.scalar(select(Category).where(Category.name == name))
    items = session.scalars(
        select(TemplateItem)
        .where(TemplateItem.category_id == category.id)
        .order_by(TemplateItem.sort_order)
    ).all()
    return [item.name for item in items]


def test_seven_categories_with_templates_exist_in_order(session):
    for name, count in EXPECTED_COUNTS.items():
        assert len(_template(session, name)) == count, name


def test_template_items_are_in_documented_order(session):
    hp = _template(session, "HP")
    assert hp[0] == "原稿の確認"
    assert hp[-1] == "管理表記入"
    customs = _template(session, "通関")
    assert customs[0] == "取引内容の情報収集"
    assert customs[-1] == "通関書類の格納"


def test_seed_keeps_existing_categories_and_is_safe_to_run_again():
    """すでにデータのある DB でも、壊さない。もう一度実行しても、増えない。"""
    admin_url = URL.create(
        "mysql+pymysql",
        username="root",
        password=os.environ["MYSQL_ROOT_PASSWORD"],
        host="127.0.0.1",
        port=int(os.environ.get("MYSQL_PORT", "3306")),
        query={"charset": "utf8mb4"},
    )
    seed_url = admin_url.set(database=SEED_DB)
    admin = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {SEED_DB}"))
        conn.execute(text(f"CREATE DATABASE {SEED_DB} CHARACTER SET utf8mb4"))

    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = seed_url.render_as_string(hide_password=False)
    engine = None
    try:
        config = Config(str(ALEMBIC_INI))
        command.upgrade(config, "0001")  # 表だけの状態
        engine = create_engine(seed_url)
        with Session(engine) as s:  # ユーザーが自分で作った「通関」（項目は1つだけ）
            custom = Category(name="通関")
            s.add(custom)
            s.flush()
            s.add(TemplateItem(category_id=custom.id, name="自分で作った項目", sort_order=1))
            s.commit()

        command.upgrade(config, "head")
        with Session(engine) as s:
            assert s.query(Category).count() == 7
            assert _template(s, "通関") == ["自分で作った項目"]  # 上書きされない
            assert len(_template(s, "HP")) == 8

        command.stamp(config, "0001")  # 「まだ 0002 を実行していない」ことにして、もう一度
        command.upgrade(config, "head")
        with Session(engine) as s:
            assert s.query(Category).count() == 7  # 増えない
            assert s.query(TemplateItem).count() == 1 + (8 + 12 + 5 + 6 + 9 + 6)  # 重ならない
    finally:
        if engine is not None:
            engine.dispose()
        if previous is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous
        with admin.connect() as conn:
            conn.execute(text(f"DROP DATABASE IF EXISTS {SEED_DB}"))
        admin.dispose()
