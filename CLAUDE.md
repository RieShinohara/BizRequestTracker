# CLAUDE.md

このプロジェクトで、Claude Code が**必ず守る**ルール。ここに書いてあることは、毎回の会話で読み込まれる。
ルールを変えたいときは、ユーザーと相談して、このファイルを更新する（それも、Issue → ブランチ → PR の流れで行う）。

## 1. プロジェクトの概要
- 社内業務依頼管理＆作業テンプレートアプリ（AIエンジニア養成コースの課題。TaskManagement に続く、2本目のアプリ）
- 他部署からの制作依頼（通関書類、HP、取扱説明書、動画など）を、表（一覧）と詳細モーダルで管理する。使う人は1人
- リポジトリ：`RieShinohara/BizRequestTracker`（**公開リポジトリ**）
- 技術：バックエンドは Python + FastAPI（SQLAlchemy + Alembic、uv）、DBは MySQL、画面は Vue 3（TypeScript）+ Vuetify。ドラッグ＆ドロップは vue-draggable-plus など。画面のビルドツールは Vite（スクールのメンターに使ってよいと確認済み）。詳しい決定と1本目との比較は [docs/tech-stack.md](docs/tech-stack.md)
- **課題の条件：TaskManagement から、言語とフレームワークと DB を変える**（メンターに確認済み：Java・Spring Boot と React を変えればよい。DB は PostgreSQL 以外）。TypeScript、Vite は同じでよい。Git・GitHub・GitHub Actions・Terraform・AWS は、作業用の道具なので同じでよい。技術を選ぶときは、[docs/tech-stack.md](docs/tech-stack.md) の比較表で確認する
- デプロイ先：AWS（EC2 ＋ RDS。**Terraform の構成は、1本目と同じ**）。DB は RDS が対応するものから選ぶ（SQLite は RDS 非対応のため使わない）。デプロイ中に画面録画をして、終わったら `destroy` する
- 状況：要件定義書（[docs/requirements.md](docs/requirements.md)）は完了（機能一覧・画面設計・非機能要件・技術スタック・受け入れ条件・ユースケース）。データ設計（[docs/data-model.md](docs/data-model.md)）、画面のプロトタイプ（`prototype/`）、API 設計（[docs/api-design.md](docs/api-design.md)）は完了。バックエンドの骨組み（`backend/`：Python 3.13・uv・FastAPI・pytest・ruff、MySQL 8.4 は Docker）を作成。DB 接続とテーブル作成（SQLAlchemy・Alembic）も完了。依頼者・カテゴリー・テンプレート項目の API（9本）、依頼の追加・1件取得・更新・削除（4本）も完了。件数と確認先の候補（`summary`・`confirm-targets`）も完了（17本中15本）。期限の色（営業日の計算、`due_level`。祝日は jpholiday）も完了。依頼の一覧（検索・絞り込み・並び替え）と手動の並びの保存も完了し、**API は全17本が完成**。画面の骨組み（`frontend/`：Vue 3・TypeScript・Vuetify・Vite・Vitest・ESLint・Prettier。API につながる確認画面）も作成。一覧と件数の表示（`GET /api/requests`・`/api/summary`。表示のみ）も完了。検索・絞り込み・並び替えの画面も完了。一覧からのステータス変更と確認先の入力も完了。詳細モーダルの表示と編集も完了。依頼の追加、チェックリストの編集、アーカイブと削除、ドラッグ（手動の並びの保存）も完了し、**画面の機能は一通りそろった**。見た目の調整（文字色・フォント・「必須」の色）も完了。品質チェックの点検（[docs/quality-review.md](docs/quality-review.md)）も実施し、指摘の判断待ち。初期データの7カテゴリーと各テンプレートは、マイグレーション 0002 で入れる（D1 は対応済み）。カテゴリー管理とテンプレート編集の画面（UC-10・UC-9）も完了（D2 は対応済み）。指摘の対応は一通り完了し、CI（GitHub Actions）も作成した。道具の追加（画面の部品のテスト、アクセシビリティの自動検査、カバレッジ）も、すべて完了。README を、初めて見る人向けに書き直し、画面録画（GIF・MP4。`docs/media/`）を入れた。**デプロイ（AWS）も実施済み**：2026-11-10 に、Terraform（`terraform/`）で段階ごとに EC2・RDS を作り、アプリを置いて（`deploy/`）、動作確認と録画をして、`terraform destroy` した。**AWS に残っている物は、0件**（構成は `docs/infrastructure.md`、記録は学習ノート 41）。2本目の動画（カテゴリー管理・テンプレート編集）も、README に追加した。`main` ブランチの保護と、CI の必須チェックは、設定済み（3.7）。手順書の書き直しと `deploy/setup.sh`、品質チェックの記録の Terraform の章（9 章）、CI への Terraform のチェック（必須チェックにも設定済み）も完了。`*.tfplan` の名前の決まりも、`terraform/README.md` に書いた。**課題は、2026-11-11 に提出し、2026-11-12 にメンターの承認とコメント（READMEの整理が、理想的）をもらった**。残る作業は、`setup.sh` の通しの確認（次のデプロイの日）
- 構成（予定）：`docs/`（要件定義）、`backend/`、`frontend/`、`terraform/`、`prototype/`（使い捨ての試作）、`notes/`（学習ノート）

## 2. ユーザーへの接し方
- ユーザーは、IT未経験の初学者。**日本語**で、専門用語は、かみ砕いて説明する
- Claude Code が作業を進め、ユーザーが確認する。仕組みや理由を、作りながら説明する
- **毎回の最初に、前回までの振り返りをする**（ユーザーの言葉で確認し、合っている所・補足・訂正を返す）
- **上流工程（要件定義・画面設計）は、小刻みに進める**：質問 → 回答 → 反映を1つずつ。決定ごとに確認を取る。実装などの下流は、速く進める
- Claude Code が補った点（要件にない提案）は、必ず明示して、ユーザーに確認する。技術・機能の決定権は、ユーザー
- ユーザーの学習が目的。学習ノート（`notes/`）に、学びを残す

## 3. GitHubの運用ルール（厳守）

### 3.1 作業の流れ（例外なし）
どんなに小さな作業（誤字の修正、文書の1行の追加）でも、次の順番で行う。

```
1. Issue を作る          何をするかを、先に書く（作業を始める前に）
2. ブランチを作る        Issueと連動させる（番号が同じ）
3. 作業して、コミットする
4. push して、PR を作る   PRの本文に「Closes #番号」と書く
5. ユーザーが確認して、マージする（GitHub上のブランチは、マージと同時に自動で削除される）
6. Claude Code が、手元の main を更新して、手元のブランチを整理する
```

### 3.2 Issue
- **作業を始める前に、必ず Issue を作る。** Issue がない作業は、始めない
- **1つの Issue ＝ 1つの目的 ＝ 1つのブランチ ＝ 1つの PR。** 複数の目的を、混ぜない
- 作成は `gh issue create` で行う。タイトルは日本語
- 本文は、次の3つの見出しで書く：`## 背景`、`## やること`（チェックリスト）、`## 完了条件`
- ラベル：文書は `documentation`、機能追加は `enhancement`、不具合は `bug`
- 機能は、**バックエンドのAPI → 画面** の順に、別々の Issue・PR にする。APIがマージされてから、画面に進む

### 3.3 ブランチ
- **main の上で、作業しない。** `main` に、直接コミットも、pushもしない
- 名前の形式：`種類/Issue番号-英語の短い説明`（英小文字、数字、ハイフンのみ）。種類は `feature`（機能追加）、`fix`（不具合）、`docs`（文書だけ）、`refactor`（整理）、`chore`（設定・環境）
- 作り方：`main` を最新にして、**`gh issue develop 番号 --name ブランチ名 --base main --checkout`**
- Issue番号と、ブランチの番号は、同じにする（PRの番号は別になる）

### 3.4 コミット
- **日本語**で書く。1つのコミット＝1つの目的
- 1行目：何をしたかを、短く（目安：50文字以内、句点は付けない）。空行のあと、本文（なぜ、どうしたか。必要なときだけ）
- 最後に、`Refs #Issue番号` を書く。末尾に、システムから指示された `Co-Authored-By` の行を付ける
- `git add` は、ファイルを1つずつ指定する。**`.claude/`、`.env` は、コミットしない**（ただし `.claude/skills/` と `.claude/settings.json` は例外で、コミットしてよい。**`.claude/settings.local.json` は、個人用なので、コミットしない**）。`settings.json` をコミットする前に、**中身を読んで、秘密・個人情報・自分の PC のパスが入っていないか確かめる**。許可する操作は、読み取りだけの物（`git status`・`git diff`・`gh issue view`・テストや lint の実行など）にし、書き込み・削除・AWS を動かす操作（`git push`・`terraform apply`・`destroy` など）は、許可しない（毎回、確認する）
- コミットの前に、`git status` で、対象を確認する
- **コミット・push・PR作成は、ユーザーの「進めて」を確認してから行う**

### 3.5 Pull Request
- **変更は、必ず PR で、main に入れる。** PR は、`gh pr create` で作る。タイトルは日本語
- 本文に、`## 内容`、`## 確認したこと`（実行したテストや動作確認の結果）、**`Closes #Issue番号`** を書く
- PR を作る前に、**テスト・静的チェック・ビルドを実行**し、結果を `## 確認したこと` に書く（具体的なコマンドは、5 の表）。文書だけの PR は、リンク切れなどの確認
- ブラウザで見ないと分からないこと（見た目など）は、「**ユーザーの確認が必要**」と書く。確かめていないことを、確認済みと書かない
- 本文の最後に、システムから指示された `Generated with Claude Code` の行を付ける
- **PRのマージは、ユーザーが行う。** Claude Code は、マージしない。GitHub上のブランチは、マージすると自動で削除される（リポジトリ設定 `delete_branch_on_merge`。2026-11-03 設定）
- マージのあと、ユーザーから連絡があったら：`main` に移動 → `git pull` → `git branch -d`（手元のブランチ） → `git fetch --prune`

### 3.6 禁止事項
- `main` への、直接のコミットとpush
- `git push --force`、`git reset --hard`、`--no-verify`。ユーザーに頼まれても、まず、理由を確認する
- Issue なしで、作業を始めること
- ユーザーの確認なしに、PRをマージすること、マージされていないブランチを削除すること

### 3.7 GitHub側の設定
- マージしたら、PRのブランチを自動で削除する設定を、有効にした（2026-11-03）
- CI（GitHub Actions）：2026-11-08 に作成（`.github/workflows/ci.yml`。`backend（pytest・ruff）` と `frontend（lint・test・build）` の2つのジョブ。PR と main への push で動く）。**2026-11-11 に、`terraform（fmt・validate・tflint・trivy）` のジョブを追加（Issue #143）**。AWS にはつながない。道具の版は固定（terraform 1.16.6・tflint 0.65.0・trivy 0.76.1）
- **`main` ブランチの保護と、CI の必須チェックを、設定した（2026-11-08。Issue #115。ユーザーが承認）**：
  - PR が必須（`main` への直接の push は、できない。承認の人数は 0＝1人開発のため、他の人の承認は要らない）
  - **`backend（pytest・ruff）`・`frontend（lint・test・build）`・`terraform（fmt・validate・tflint・trivy）` が、3つとも成功しないと、マージできない**（terraform は、2026-11-11 に追加。ユーザーが承認。Issue #145）
  - **管理者（ユーザー本人）にも適用する**。強制 push と、`main` の削除は、禁止
  - 入れていない設定：「ブランチを最新にしないとマージできない」（1人開発では、面倒が増えるだけ）
  - **設定前の状態は「保護なし」**（terraform を足す前は、必須チェックは backend と frontend の2つ。戻すときは、`gh api -X PATCH repos/RieShinohara/BizRequestTracker/branches/main/protection/required_status_checks` で、その2つに書き直す）。**戻し方**：`gh api -X DELETE repos/RieShinohara/BizRequestTracker/branches/main/protection`（CI 自体が壊れて、マージが止まったときの、一時的な対処。外したら、直してから、同じ設定に戻す）。設定の内容は、`gh api repos/RieShinohara/BizRequestTracker/branches/main/protection` で、読める
  - **`ci.yml` のジョブの `name` を変えると、必須チェックが「見つからない」状態になり、永遠に待つ**。変えるときは、GitHub 側の設定も、同時に直す
  - CI が ✗ のときは、直してから、ユーザーに確認を頼む（✗ のままでは、ユーザーも、マージできない）

### 3.8 見た目の調整のやり方
- 色・濃さ・大きさなど、**見た目の調整は、先に Issue を作る**
- そのうえで、**コミットしない試しの変更**を、起動中の画面に入れて、ユーザーに見てもらう。決まってから、コミット・PR にする
- ブランチを切り替えるときは、`git stash` で、試しの変更を、一時的にしまう

## 4. 公開リポジトリとしての注意
- **パスワード、キー、個人情報を、コミットしない。** 秘密は `.env`（コミットしない）に書く。見本は `.env.example`
- **サンプルデータは、すべて架空にする。** 実在の会社名、人名、実際の依頼内容を、入れない
- データベースの中身や、`mysqldump` で書き出したファイル（`*.sql`、`*.dump`）は、コミットしない（`.gitignore` で除外する）。DB のパスワードは `.env`（コミットしない）に書く
- 権利が不明な画像や文章を、入れない（画像は、出典とライセンスを、`CREDITS.md` に書く）
- **AWS の秘密を、コミットしない・チャットに貼らない。** アクセスキー、パスフレーズ、SSH の**秘密鍵**、アカウント ID は、出さない。`terraform.tfvars`、`*.tfstate`、`*.tfplan` も、コミットしない
- **画面録画・スクリーンショットに、IP アドレスやアカウント ID が映らないようにする**（README に載せる前に確認する）

## 5. 開発のコマンド
### バックエンド（`backend/` で実行）
| 目的 | コマンド |
|---|---|
| 部品を入れる | `uv sync` |
| API を起動 | `uv run uvicorn app.main:app --port 8000` |
| テスト（MySQL の起動が必要。テスト専用の DB を作って、終わると消す） | `uv run pytest` |
| テストと、カバレッジ（テストがコードのどこまで通ったか）の測定。しきい値（95%）を下回ると失敗する。`.coverage` は、コミットしない | `uv run pytest --cov` |
| 表を作る・最新にする | `uv run alembic upgrade head` |
| 1つ前に戻す | `uv run alembic downgrade -1` |
| モデルの変更から、マイグレーションを作る | `uv run alembic revision --autogenerate -m "説明"`（できたファイルは、中身を読んで確認する） |
| 静的チェック | `uv run ruff check .` |
| 整形の確認 / 整形 | `uv run ruff format --check .` / `uv run ruff format .` |

**CI（GitHub Actions）は、上の「静的チェック・テスト・整形の確認・ビルド」を、PR のたびに自動で行う。** PR を作ったら、Checks の結果を確かめる（緑の ✓ だけでなく、ログで、テストの件数が出ていることも見る）。手元では、CI は動かせない。

### MySQL（Docker。リポジトリ直下で実行）
| 目的 | コマンド |
|---|---|
| 初回の準備 | `.env.example` を `.env` にコピーし、パスワードを自分で決める |
| 起動 | `docker compose up -d db` |
| 停止 | `docker compose stop db`（データは残る。`down -v` はデータも消えるので、確認してから） |

### 画面（`frontend/` で実行。PowerShell では `npm.cmd`）
| 目的 | コマンド |
|---|---|
| 部品を入れる | `npm install` |
| 開発用サーバーを起動（http://localhost:5173。`/api` と `/health` は、API の 8000 番に中継される。先に API を起動する） | `npm run dev` |
| テスト（関数のテストと、画面の部品のテスト。部品のテストは、ファイルの先頭に `// @vitest-environment jsdom` と書く） | `npm run test` |
| 静的チェック | `npm run lint` |
| 整形の確認 / 整形 | `npm run format:check` / `npm run format` |
| テストと、カバレッジ（テストがコードのどこまで通ったか）の測定。しきい値を下回ると失敗する。詳しい表は、`coverage/index.html`（コミットしない） | `npm run test:coverage` |
| ビルド（型チェックを含む） | `npm run build` |

`prototype/` は、使い捨ての試作（参考用）。本番の画面は `frontend/`。

- **ポートは固定**：API は **8000**、MySQL は **3306**、画面（Vite）は **5173**。サーバーを起動する前に、使用中でないか確認し、別のポートでは起動しない。無関係なプロセスは、ユーザーの確認なしに止めない
- Windows の PowerShell では、`npm` は `npm.cmd` で実行する

### Terraform（AWS）の約束
- **`terraform apply` と `destroy` は、ユーザーが承認するまで、実行しない。** 先に `plan` を読み上げて、何が作られる・消されるかを説明する。AWS に何かを作る操作も同じ
- **費用がかかる物は、使い終わったら `destroy` で消す。** 消したあと、残っていないか確かめる
- `terraform.tfstate` は、消さない
- セキュリティグループの入口は、**自分の IP（`/32`）だけ**。`0.0.0.0/0` を、入口（ingress）に書かない
- `terraform fmt` は、`.tf` ファイルを指定して使う（引数なしや `-diff` は、`terraform.tfvars` の中身が画面に出る）

## 6. 進め方と文書の置き場所
- 進める順番：**要件定義 → プロトタイプ → API → 画面 → 品質チェック → デプロイ（AWS）**
- 要件定義：`docs/`（入口は `docs/requirements.md`）。使い方：`README.md`（入口）
- 技術の決定：`docs/tech-stack.md`。技術や、バージョンを変えたら、更新する
- 学習ノート：`notes/`。新しく学んだことは、ここに追記する
- **機能を足したとき、仕様と実際がずれたときは、同じ PR で、学習ノート・README・仕様書を更新する。** 仕様を変えるときは、先にユーザーに確認する
