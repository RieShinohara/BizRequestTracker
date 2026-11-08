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
uv run alembic upgrade head   # 表を作る＋初期データ（7つのカテゴリーとテンプレート）を入れる（初回と、マイグレーションが増えたとき）
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
npm run format:check   # 整形の確認（書き換えない）。直すときは npm run format
npm run build   # 型チェックとビルド
```

開発用サーバーは、画面から呼ぶ `/api` と `/health` を、API（8000番）に中継する。
今の画面でできること：依頼の一覧と、画面上部の件数の表示（「アーカイブも表示」の切り替えつき）、検索・絞り込み（QMS・カテゴリー・ステータス）・並び替え（優先度・期限日・ステータス）、一覧からのステータス変更（確認待ちのときは確認先も入力）。一覧の行を押して開く詳細モーダルでの編集（チェックリストの編集・テンプレートを入れるを含む）。「新しい依頼」ボタンからの依頼の追加。アーカイブ・元に戻す・完全な削除、手動の並びのドラッグ（取っ手をつかんで動かす）。「カテゴリー管理」ボタンからの、カテゴリーの追加・名前の変更・削除と、カテゴリーごとのテンプレートの編集（項目の追加・名前の直し・削除）。これで、要件の画面の機能は、そろった。
`prototype/` は、画面の見た目を確かめた使い捨ての試作（API にはつながない）。

## CI（自動チェック）
PR を作ると、GitHub Actions（`.github/workflows/ci.yml`）が、手元でやっている確認を、自動で行う。バックエンドは、MySQL を CI の中で起動して、`pytest`・`ruff check`・`ruff format --check`。画面は、`lint`・`format:check`・`test`・`build`。結果は、PR の「Checks」で見られる。

## 文書
- [要件定義](docs/requirements.md)（入口。機能一覧・ユースケース・画面設計・非機能要件・受け入れ条件へ）
- [機能一覧](docs/functional-requirements.md)
- [ユースケース](docs/use-cases.md)
- [画面設計](docs/screen-design.md)
- [データ設計](docs/data-model.md)
- [API 設計](docs/api-design.md)
- [非機能要件](docs/non-functional-requirements.md)
- [技術スタック](docs/tech-stack.md)
- [品質チェックの記録](docs/quality-review.md)
- [画面のプロトタイプ](prototype/README.md)
- [学習ノート](notes/README.md)
