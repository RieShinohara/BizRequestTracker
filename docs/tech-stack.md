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
| データベース | MySQL | AWS では RDS に置く（公開しない。入口は EC2 からだけ）。PC での開発用の MySQL は、Docker で起動する案（最終確認は、骨組みを作るとき） |
| DB の扱い方 | SQLAlchemy ＋ Alembic | Python で最も使われている組み合わせ。テーブルの変更の履歴が残る |
| サーバー側のパッケージ管理 | uv | Python 本体の導入と、部品・仮想環境の管理を、1つの道具で行う |
| サーバー側のテスト・静的チェック | pytest、ruff | |
| 画面 | Vue 3 ＋ TypeScript ＋ Vuetify | 選んだ理由：課題の条件で React を変える必要があった。先生が Material UI（Material Design の部品集）を使ったと聞き、Vue にも同じ種類の部品集（Vuetify）があると知った。表・ボタン・モーダル・入力欄が最初から用意されていて、一覧と詳細モーダルの画面に合う（ユーザーの記憶による。当時の比較の記録はない） |
| ドラッグ＆ドロップ | vue-draggable-plus | |
| 画面のビルド | Vite | |
| 画面のテスト・静的チェック・整形 | Vitest、ESLint、Prettier | |
| 画面のパッケージ管理 | npm | Windows の PowerShell では `npm.cmd` で実行する |
| 作業用の道具 | Git ＋ GitHub、GitHub Actions、Terraform、AWS（EC2 ＋ RDS） | |

## 4. バージョン
- 画面のプロトタイプ（`prototype/`）で使っているもの：Vue 3.5.44、Vuetify 4.3.2、Vite 8.3.5、TypeScript 6.0.3
- Python と FastAPI など、バックエンドのバージョン：導入するときに、その時点の最新の安定版を調べて、ユーザーと相談して決める（Python は、この PC にまだ入っていない）
- 本番の画面（`frontend/`）のバージョン：画面の環境を作るときに決める

## 5. 未決定の項目
- Python のバージョン（導入するときに決める）
- MySQL のバージョン、MySQL につなぐ Python の部品（ドライバ）、PC での開発用 MySQL の起動方法（Docker の案）（骨組みを作るときに決める）
- 日本の祝日を判定するライブラリ（営業日の計算に使う。API を作るときに決める）
- バックエンドと画面の、ポート番号（骨組みを作るときに決める）
- 自動チェック（CI）で実行する内容（骨組みができてから決める）
