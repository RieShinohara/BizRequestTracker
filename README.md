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
# API の一覧と試し打ち： http://127.0.0.1:8000/docs（FastAPI が自動で作る説明画面）

# テスト・静的チェック
uv run pytest
uv run ruff check .
```

## 動かし方（画面）
前提：Node.js が入っていること。先に、上の手順で API を起動しておく。

```
cd frontend
npm install
npm run dev     # http://localhost:5173 を開く（ポートは固定）
npm run test    # テスト
npm run lint    # 静的チェック
npm run build   # 型チェックとビルド
```

開発用サーバーは、画面から呼ぶ `/api` と `/health` を、API（8000番）に中継する。
今の画面でできること：依頼の一覧と、画面上部の件数の表示（「アーカイブも表示」の切り替えつき）、検索・絞り込み（QMS・カテゴリー・ステータス）・並び替え（優先度・期限日・ステータス）、一覧からのステータス変更（確認待ちのときは確認先も入力）。一覧の行を押して開く詳細モーダルでの編集（チェックリストの編集・テンプレートを入れるを含む）。「新しい依頼」ボタンからの依頼の追加。アーカイブ・元に戻す・完全な削除、手動の並びのドラッグ（取っ手をつかんで動かす）。これで、画面の機能は一通りそろった。
`prototype/` は、画面の見た目を確かめた使い捨ての試作（API にはつながない）。

## 文書
- [要件定義](docs/requirements.md)
- [データ設計](docs/data-model.md)
- [画面のプロトタイプ](prototype/README.md)
- [学習ノート](notes/README.md)
