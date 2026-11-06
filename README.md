# BizRequestTracker
社内業務依頼管理＆作業テンプレートアプリ（AIエンジニア養成コースの課題）

## 動かし方（バックエンド）
前提：[uv](https://docs.astral.sh/uv/) と Docker Desktop が入っていること。

```
# 1. MySQL（Docker）。.env.example を .env にコピーして、パスワードを決めてから
docker compose up -d db

# 2. API（backend/ で）
cd backend
uv sync
uv run alembic upgrade head   # 表を作る（初回と、マイグレーションが増えたとき）
uv run uvicorn app.main:app --port 8000
# 確認： http://127.0.0.1:8000/health  →  {"status":"ok"}

# テスト・静的チェック
uv run pytest
uv run ruff check .
```

## 文書
- [要件定義](docs/requirements.md)
- [データ設計](docs/data-model.md)
- [画面のプロトタイプ](prototype/README.md)
- [学習ノート](notes/README.md)
