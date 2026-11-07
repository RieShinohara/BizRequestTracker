# 学習ノート

AIエンジニア養成コースの学習記録です。Claude Codeと一緒に、社内業務依頼管理アプリ（BizRequestTracker）を作る中で学んだことを、あとから見返せるようにまとめています。
1本目のアプリ（タスク管理アプリ）では、Java + Spring Boot + PostgreSQL + React で作りました。2本目の今回は、言語・フレームワーク・DB を変えて（Python + FastAPI + MySQL + Vue 3）、同じ工程をたどります。

| ノート | 内容 |
|---|---|
| [01-requirements-to-prototype.md](01-requirements-to-prototype.md) | 作業の進め方（Issue → ブランチ → PR）、要件定義のヒアリング、データ設計、画面のプロトタイプ（Vue 3 + Vuetify + Vite）。決めたことと、その理由 |
| [02-requirements-docs.md](02-requirements-docs.md) | 要件定義書を項目別の文書に整えた記録。文書の役割（非機能要件・受け入れ条件・ユースケース）、課題の条件の確認、DB を SQLite から MySQL（RDS）に変えた経緯、技術の選び方 |
| [03-api-design.md](03-api-design.md) | API 設計の記録。API と REST の考え方、検索・並び替えをサーバー側で行う理由、エラーの番号、ユースケースを読んで設計の見落としに気づいた経緯 |
| [04-rest-cheatsheet.md](04-rest-cheatsheet.md) | REST API の早見表（確認テストの復習用）。操作とメソッド、URL の決まり、ステータスコード、JSON。このアプリの例つき |
| [05-architecture.md](05-architecture.md) | 画面とバックエンドの構成。「構成が別々」と「担当が別々」の違い、分けた構成と一体型（Next.js）の比較、Vue・React・Next.js の位置づけ |
| [06-backend-skeleton.md](06-backend-skeleton.md) | バックエンドの骨組みの記録。uv・FastAPI・Docker の MySQL・pytest・ruff。つまずいたことと、その直し方 |
| [07-db-models-migration.md](07-db-models-migration.md) | DB 接続とテーブル作成の記録。SQLAlchemy のモデル、Alembic のマイグレーション、削除時の動き、テスト専用 DB |
| [08-requesters-categories-api.md](08-requesters-categories-api.md) | 依頼者・カテゴリーの API の記録。ルーター、スキーマ、Depends、PATCH の「送った項目だけ」、重複を DB に判断させる理由、ステータスコード |
| [09-template-items-api.md](09-template-items-api.md) | テンプレート項目の API の記録。PUT（全部入れ替え）の考え方、順番の表し方、入れ替えの作り方 |
| [10-requests-crud-api.md](10-requests-crud-api.md) | 依頼の API（追加・取得・更新・削除）の記録。許される値の確認、PATCH の null、チェックリストの入れ替え、「いちばん上」の作り方、削除の条件 |
| [11-summary-confirm-targets-api.md](11-summary-confirm-targets-api.md) | 件数と確認先の候補の API の記録。集計を DB に任せる、0件も返す、設定ファイル、過去の入力から候補を作る |
| [12-due-level.md](12-due-level.md) | 期限の色（営業日の計算）の記録。祝日ライブラリの選び方、会社の休み、日本時間、テストで「今日」を固定する、境目の日のテスト |
| [13-requests-list-order-api.md](13-requests-list-order-api.md) | 依頼の一覧と並びの保存の API の記録。検索・絞り込み・並び替え、決まった順番に並べる、`%` のエスケープ、N+1 問題 |
| [14-frontend-skeleton.md](14-frontend-skeleton.md) | 画面の骨組みの記録。開発用サーバーの中継（CORS を避ける）、`localhost` と `127.0.0.1`、API を呼ぶ部品を1か所に集める、Vitest・ESLint・Prettier の役割 |
| [15-development-approach.md](15-development-approach.md) | 進め方の比較。機能ごとに API と画面を作る方式（1本目）と、API を先に全部作る方式（2本目）の長所・短所・向く場面。今回の判断の理由 |
| [16-frontend-request-list.md](16-frontend-request-list.md) | 画面の一覧と件数の表示の記録。期限の色は API が決める、2つの API の同時呼び出し、失敗は例外で伝える、日付の曜日と UTC |
| [17-frontend-search-filter-sort.md](17-frontend-search-filter-sort.md) | 画面の検索・絞り込み・並び替えの記録。URL の作り方（`URLSearchParams`）、デバウンス、古い応答で上書きしない、`defineModel` |

## 今後、追加する予定
画面の続き（詳細モーダル・ドラッグ）、品質チェック、AWS へのデプロイ。（バックエンドは、API 全17本まで完成）

## 会話の記録について
Claude Codeとの会話は、PCの中に保存されています。

- 保存場所：`C:\Users\<ユーザー名>\.claude\projects\` の中の、`.jsonl` ファイル
- 見返し方：Claude Codeの画面の上にある、**時計のアイコン**から、過去の会話を開く
- 要点のメモ（Claudeが次回のために残す記録）は、同じ場所の `memory` フォルダにある
