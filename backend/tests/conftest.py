"""DB を使うテストの準備。

MySQL（docker compose up -d db）が起動していることが前提。
開発用のデータを壊さないよう、テスト専用の DB（biz_request_tracker_test）を作って使い、
終わったら消す。
"""

import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import URL, create_engine, text
from sqlalchemy.orm import Session

import app.config  # noqa: F401  # .env を読み込む

TEST_DB = "biz_request_tracker_test"


def _root_url(database: str | None = None) -> URL:
    # テスト DB を作ったり消したりするため、root で接続する
    return URL.create(
        "mysql+pymysql",
        username="root",
        password=os.environ["MYSQL_ROOT_PASSWORD"],
        host="127.0.0.1",
        port=int(os.environ.get("MYSQL_PORT", "3306")),
        database=database,
        query={"charset": "utf8mb4"},
    )


@pytest.fixture(scope="session")
def engine():
    admin = create_engine(_root_url(), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {TEST_DB}"))
        conn.execute(text(f"CREATE DATABASE {TEST_DB} CHARACTER SET utf8mb4"))

    # Alembic（migrations/env.py）は DATABASE_URL を優先して使う
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _root_url(TEST_DB).render_as_string(hide_password=False)
    try:
        # マイグレーションで表を作る＝マイグレーション自体のテストにもなる
        command.upgrade(Config(str(Path(__file__).resolve().parents[1] / "alembic.ini")), "head")
        test_engine = create_engine(_root_url(TEST_DB))
        yield test_engine
        test_engine.dispose()
    finally:
        if previous is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous
        with admin.connect() as conn:
            conn.execute(text(f"DROP DATABASE IF EXISTS {TEST_DB}"))
        admin.dispose()


@pytest.fixture
def db(engine):
    """API のテスト用の Session。

    commit しても、本当の保存にはならず（仮の保存）、テストの最後に全部取り消す。
    API の中と、テストの中で、同じ Session を使う（API で作ったものを、テストから確認できる）。
    """
    connection = engine.connect()
    outer = connection.begin()
    with Session(connection, join_transaction_mode="create_savepoint") as s:
        yield s
    outer.rollback()
    connection.close()


@pytest.fixture
def client(db):
    """API を試すための道具。API が使う Session を、上の db に差し替える。"""
    from fastapi.testclient import TestClient

    from app.deps import get_db
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def session(engine):
    """1テストごとに、最後に取り消す（rollback）。テスト同士が影響しあわない。"""
    with Session(engine) as s:
        yield s
        s.rollback()
