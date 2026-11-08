# 技術スタック

このアプリで使う技術と、その理由。技術やバージョンを変えたら、この文書を更新する。
条件は [非機能要件](non-functional-requirements.md)、データは [データ設計](data-model.md) を参照。

## 1. 課題の条件
- 2本目のアプリ。1本目（TaskManagement）から、**言語とフレームワークを変える**（メンターに確認済み：Java・Spring Boot と React を変えればよい）
- **データベースも、1本目（PostgreSQL）とは別のものにする**。TypeScript は、同じでよい。Vite も、メンターに使ってよいと確認済み
- デプロイ先は **AWS の EC2 ＋ RDS**（Terraform の構成は、1本目と同じ）。そのため、データベースは RDS が対応するもの（MySQL、MariaDB など）から選ぶ。**SQLite は RDS が対応していないため、使わない**

## 2. 1本目との比較
| 部分 | 1本目（TaskManagement） | 今回 | 変えたか |
|---|---|---|---|
| バックエンドの言語 | Java | **Python** | 変えた |
| バックエンドのフレームワーク | Spring Boot | **FastAPI** | 変えた |
| データベース | PostgreSQL | **MySQL**（RDS） | 変えた |
| DB の扱い方 | Spring Data JPA | **SQLAlchemy** | 変えた |
| テーブルの変更の管理 | Flyway | **Alembic** | 変えた |
| サーバー側のパッケージ管理 | Gradle | **uv** | 変えた |
| サーバー側のテスト | JUnit ＋ Testcontainers | **pytest** | 変えた |
| サーバー側の静的チェック・整形 | Checkstyle・SpotBugs | **ruff** | 変えた |
| 画面のフレームワーク | React | **Vue 3** | 変えた |
| 画面の部品・見た目 | Tailwind CSS | **Vuetify** | 変えた |
| ドラッグ＆ドロップ | dnd-kit | **vue-draggable-plus** | 変えた |
| 画面のテスト | Vitest | Vitest | 同じ（Vue でも使える標準的な道具） |
| 画面の静的チェック | oxlint | **ESLint** | 変えた |
| 画面の整形 | Prettier | Prettier | 同じ |
| 画面の言語 | TypeScript | TypeScript | 同じ（条件で許可） |
| 画面のビルドツール | Vite | Vite | 同じ（メンター確認済み） |
| 画面のパッケージ管理 | npm | npm | 同じ |
| API の形式 | REST API | REST API | 同じ |
| バージョン管理 | Git ＋ GitHub | Git ＋ GitHub | 同じ（作業用の道具） |
| 自動チェック（CI） | GitHub Actions | GitHub Actions | 同じ（作業用の道具） |
| デプロイ先 | AWS（EC2 ＋ RDS） | AWS（EC2 ＋ RDS） | 同じ（作業用の道具。課題の条件） |
| AWS の構築 | Terraform | Terraform | 同じ（作業用の道具） |

## 3. 確定した技術
| 部分 | 技術 | 備考 |
|---|---|---|
| バックエンド | Python ＋ FastAPI | |
| データベース | MySQL | AWS では RDS に置く（公開しない。入口は EC2 からだけ）。PC での開発用の MySQL は、Docker で起動する |
| DB の扱い方 | SQLAlchemy ＋ Alembic | Python で最も使われている組み合わせ。テーブルの変更の履歴が残る |
| サーバー側のパッケージ管理 | uv | Python 本体の導入と、部品・仮想環境の管理を、1つの道具で行う |
| サーバー側のテスト・静的チェック | pytest、ruff | |
| 画面 | Vue 3 ＋ TypeScript ＋ Vuetify | 選んだ理由：課題の条件で React を変える必要があった。先生が Material UI（Material Design の部品集）を使ったと聞き、Vue にも同じ種類の部品集（Vuetify）があると知った。表・ボタン・モーダル・入力欄が最初から用意されていて、一覧と詳細モーダルの画面に合う（ユーザーの記憶による。当時の比較の記録はない） |
| ドラッグ＆ドロップ | vue-draggable-plus | |
| 画面のビルド | Vite | |
| 画面のテスト・静的チェック・整形 | Vitest、ESLint、Prettier | |
| アクセシビリティの自動検査 | axe-core 4.14.0 | 2026-11-08 に追加（版は固定。公開から2週間以上たったもの）。部品のテストの中で、画面を検査する。色のコントラストなどは、jsdom では検査できない |
| 画面の部品のテスト | @vue/test-utils、jsdom | 2026-11-08 に追加。Vue の部品を、テストの中で描いて、操作を再現する。jsdom は、ブラウザの代わり |
| 画面のパッケージ管理 | npm | Windows の PowerShell では `npm.cmd` で実行する |
| 作業用の道具 | Git ＋ GitHub、GitHub Actions、Terraform、AWS（EC2 ＋ RDS） | |

## 4. バージョン
- 画面のプロトタイプ（`prototype/`）で使っているもの：Vue 3.5.44、Vuetify 4.3.2、Vite 8.3.5、TypeScript 6.0.3
- バックエンド（2026-11-06 に決定。`backend/uv.lock` で固定）：Python 3.13、FastAPI 0.162、uvicorn 0.54、PyMySQL 1.2、SQLAlchemy 2.1、Alembic 1.20、pytest 9.2、ruff 0.17、uv 0.13
- MySQL：**8.4**（LTS。Docker イメージ `mysql:8.4`、導入時は 8.4.13）。AWS の RDS for MySQL も 8.4 に対応している。PC での開発用は Docker で起動する（`docker-compose.yml`）
- MySQL につなぐ Python の部品（ドライバ）：**PyMySQL**（Python だけで書かれていて、Windows でも追加の準備が要らない）
- ポート番号：API は 8000、MySQL は 3306、画面（Vite）は 5173（いずれも標準の番号）
- 日本の祝日を判定するライブラリ：**jpholiday**（1.0.3。2026-11-07 に決定）。候補の `holidays`（0.108）と、国民の休日・成人の日などの判定を試して、同じ結果だった。日本だけで足りて、使い方が簡単で小さいため、jpholiday を選んだ。会社の休み（12/29〜1/3、8/12〜15）は、`backend/app/settings.py` に書く
- 本番の画面（`frontend/`。2026-11-07 に作成。`frontend/package-lock.json` で固定）：Vue 3.5.45、Vuetify 4.3.2、Vite 8.3.6、TypeScript 6.0.3、Vitest 5.1.0、ESLint 10.14、Prettier 3.9.10（プロトタイプと同じ系統。部品は同じ）。部品のテスト用に、@vue/test-utils 2.5.1、jsdom 30.1.3（どちらも版を固定。公開から2週間以上たったものを選んだ）
- フォント：Noto Sans JP（`@fontsource-variable/noto-sans-jp` 5.3.1。2026-11-07 に決定。SIL Open Font License 1.1。アプリに同梱するので、外部の通信は不要。出典は `CREDITS.md`）。候補の BIZ UDPゴシック、Zen角ゴシック New と、画面上で見比べて選んだ
- ドラッグ＆ドロップの部品：vue-draggable-plus 0.6.1（2026-11-07 に導入。`frontend/package-lock.json` で固定）。本番に入る部品の `npm audit` は、0件
- 画面の開発用サーバー：`/api` と `/health` を、API の 8000 番に中継する（`frontend/vite.config.ts`）。画面と API が「同じ入口」に見えるので、ブラウザの制限（CORS）を気にしなくてよい。本番（AWS）での中継の方法は、デプロイのときに決める

## 5. 未決定の項目
- 自動チェック（CI）で実行する内容（骨組みができてから決める）
