import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL
from sqlalchemy.engine import make_url

# リポジトリ直下の .env を読む（backend/ の1つ上）
load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def database_url() -> URL:
    """.env の MYSQL_* から、DB の接続先を組み立てる。

    環境変数 DATABASE_URL があれば、それを優先する（テストで別の DB を使うため）。
    """
    override = os.environ.get("DATABASE_URL")
    if override:
        return make_url(override)
    return URL.create(
        "mysql+pymysql",
        username=os.environ["MYSQL_USER"],
        password=os.environ["MYSQL_PASSWORD"],
        host="127.0.0.1",
        port=int(os.environ.get("MYSQL_PORT", "3306")),
        database=os.environ["MYSQL_DATABASE"],
        query={"charset": "utf8mb4"},
    )
