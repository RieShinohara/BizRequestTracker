# 学習ノート

AIエンジニア養成コースの学習記録です。Claude Codeと一緒に、社内業務依頼管理アプリ（BizRequestTracker）を作る中で学んだことを、あとから見返せるようにまとめています。
1本目のアプリ（タスク管理アプリ）では、Java + Spring Boot + PostgreSQL + React で作りました。2本目の今回は、技術をすべて変えて、同じ工程をたどります。

| ノート | 内容 |
|---|---|
| [01-requirements-to-prototype.md](01-requirements-to-prototype.md) | 作業の進め方（Issue → ブランチ → PR）、要件定義のヒアリング、データ設計、画面のプロトタイプ（Vue 3 + Vuetify + Vite）。決めたことと、その理由 |

## 今後、追加する予定
API（FastAPI + SQLite）、画面（本番）、品質チェック、AWS へのデプロイ。

## 会話の記録について
Claude Codeとの会話は、PCの中に保存されています。

- 保存場所：`C:\Users\<ユーザー名>\.claude\projects\` の中の、`.jsonl` ファイル
- 見返し方：Claude Codeの画面の上にある、**時計のアイコン**から、過去の会話を開く
- 要点のメモ（Claudeが次回のために残す記録）は、同じ場所の `memory` フォルダにある
