from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app import models  # noqa: F401  # モデルを読み込んで、Base.metadata に表を登録する
from app.config import database_url
from app.db import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# autogenerate（モデルと DB の差から、マイグレーションを作る）が見る定義
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """DB につながずに、SQL 文だけを出力する。"""
    context.configure(
        url=database_url().render_as_string(hide_password=False),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """DB につないで、マイグレーションを実行する。接続先は .env から組み立てる。"""
    connectable = create_engine(database_url(), poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
