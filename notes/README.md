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

## 今後、追加する予定
バックエンドの実装（DB 接続・テーブル・API）、画面（本番）、品質チェック、AWS へのデプロイ。

## 会話の記録について
Claude Codeとの会話は、PCの中に保存されています。

- 保存場所：`C:\Users\<ユーザー名>\.claude\projects\` の中の、`.jsonl` ファイル
- 見返し方：Claude Codeの画面の上にある、**時計のアイコン**から、過去の会話を開く
- 要点のメモ（Claudeが次回のために残す記録）は、同じ場所の `memory` フォルダにある
