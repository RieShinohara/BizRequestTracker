---
name: quality-check
description: このプロジェクトの品質チェックの手順。ユーザーが「品質チェック」「全体の点検」「コードレビューして」「標準から外れていないか見て」「文書と実装のずれを直して」などと言ったとき、または大きな機能がそろった節目に点検するときは、必ずこのスキルを使うこと。バックエンド（FastAPI）、画面（Vue 3 + Vuetify）、Terraform（terraform/・deploy/。AWS の構成）、文書（docs/・README）、公開リポジトリとしての安全を、読んで点検し、静的チェック・テスト・ビルド（terraform fmt・validate、tflint、trivy を含む）を実行して、結果を docs/quality-review.md に記録する。「Terraform の点検」「インフラのチェック」「セキュリティの弱点を探して」と言われたときも使う。指摘を見つけたら、点検の PR では直さず、記録して、ユーザーに優先度を決めてもらう。
---

# 品質チェックの手順（FastAPI・Vue 版）

## 目的と原則
機能が「動く」だけでなく、「標準的な作りで、安全で、文書と合っている」ことを確かめる。1本目（TaskManagement）の品質チェックの手順（Java・React 用）を、このアプリの技術に合わせて作り直したもの。1本目の結果と学びは、`C:\CursorProject\AI_Engineer_Course\TaskManagement` の `docs/quality-review.md` と `notes/07-quality-check.md` にある（参考用）。

守ること：
- **CLAUDE.md の GitHub 運用ルールに従う。** 先に Issue を作り、ブランチ（`gh issue develop`）、コミット、PR の順。main に直接触らない。コミット・push・PR は、ユーザーの「進めて」を待つ。マージはユーザーが行う
- **点検の PR では、動作を変えるコードの修正をしない。** 指摘は `docs/quality-review.md` に記録し、直すかどうかと優先度は、ユーザーが決める。直すときは、別の Issue・PR にする（機能の修正は、API → 画面の順）
- **どちらが正しいかは、ユーザーが決める。** 文書と実装がずれていたら、基本は、実装を正にして文書を直す。ただし、ユーザーが「設計書が正」と言ったものは、文書を直さず、実装を直す別の Issue を作る。仕様を変えるときは、先にユーザーに確認する（CLAUDE.md 第6章）
- **読んで見つけたことと、動かして確かめたことを、区別して書く。** 再現していない指摘を、確認済みのように書かない。**直す前に、問題を再現できるか確かめる**（読んだだけの指摘は、外れることがある）
- **直さないと決めたことも、理由と「見直す条件」を記録する。** 測ってから決める（作業に見合わない検査は、やらなくてよい）
- ユーザーは初学者。結果は日本語で、専門用語をかみ砕いて説明する

## 手順

### 0. 計画する
点検の範囲、進め方、PR の分け方（既定は **1 Issue・1 PR**、コミットは領域別：バックエンド／画面／文書）を、先にユーザーに見せて、承認をもらう。

### 1. 現状を調べる（読み取りのみ。方面ごとに Explore エージェントを並行して使ってよい）
エージェントには、「ファイル:行、重大度（高・中・低）、理由、推奨修正」の形で報告させる。**報告は、そのまま信じず、重要な指摘は、実コードで確かめてから記録する**（行番号のずれや、見当違いがありうる）。

観点：
- **バックエンド**（`backend/app/`、`backend/tests/`、`backend/migrations/`）
  - 層の構成（`routers/` → `schemas.py`・`models.py` → DB）と依存の向き。ルーターに業務の判断が溜まっていないか
  - 入力の検査（Pydantic の制約：長さ・範囲・列挙。ステータスなど決まった値）。スキーマ（入出力の型）とモデル（DB）の分離
  - エラー処理（HTTP ステータスの使い分け：404・409・422 など。エラーの文言の統一）。`docs/api-design.md` との一致
  - DB：セッションの開閉とトランザクション（`deps.py`・`db.py`）、N+1 クエリ、索引、外部キー、削除時の挙動（カテゴリー・依頼者を消したとき）
  - 並び（`position`）の更新の一貫性。期限の色（営業日の計算、`business_days.py`）の境界（祝日・週末・今日が期限）
  - マイグレーション（Alembic）：中身を読んで確認し、`upgrade` と `downgrade` が往復できるか。モデルとの差が残っていないか
  - 設定と秘密：`settings.py`・`config.py`・`.env.example`（パスワードの既定値、CORS、デバッグの設定）。本番に出してはいけない設定
  - テストの構成：テスト専用 DB の分離、境界値と失敗の系、テストの独立性
- **画面**（`frontend/src/`）
  - 型の厳しさ（`tsconfig` の `strict`、`any`・`as` の乱用）。コンポーネントの分割と大きさ（`RequestDialog.vue` など）
  - API 層（`api.ts`）：エラー処理、返事が JSON でない場合、操作ごとのエラー文言
  - 状態管理：楽観的更新と巻き戻し、続けて操作したときの競合（ステータス変更・ドラッグの連続）、`watch` の使い方
  - アクセシビリティ：モーダルのフォーカス、キーボード操作、ラベル、色だけに頼った表示（期限の色）、コントラスト
  - XSS（`v-html` の使用）、入力の検査（画面側は親切のため。守りの本番はサーバー）
  - テストの網羅性（`*.test.ts`）。コンポーネントのテストがあるか
  - 部品（`package.json`）：不要な部品、版の固定、`npm audit`
- **Terraform**（`terraform/`、`deploy/`）：入口（ingress）に `0.0.0.0/0` がないか（CLAUDE.md 第5章）、RDS が公開されていないか、秘密の扱い（`sensitive`、`.gitignore` が `terraform.tfvars`・`*.tfstate`・`*.tfplan` を除外しているか、追跡にも履歴にも入っていないか）、変数の検証（MySQL の制限：管理者名 16 文字、パスワード 41 文字など）、費用がかかる物（NAT Gateway など）を作っていないか、部品の版の固定（`.terraform.lock.hcl`、tflint のプラグインの版）、コメントが今の状態と合っているか（「あとで足す」のまま残っていないか）、`user_data.sh` と `deploy/`（`setup.sh`・nginx・systemd）に秘密が入っていないか、`deploy/` の設定と実際の構成の一致、`docs/infrastructure.md`・`terraform/README.md`・`deploy/README.md` とのずれ、CI の `terraform` ジョブがあるか。**読み取りだけ。`apply` と `destroy` は実行しない**
- **文書**：`docs/`（要件、機能一覧、ユースケース、画面設計、データ設計、API 設計、非機能、技術スタック）、`README.md`、`backend/README.md`、`CREDITS.md`、`CLAUDE.md` の「状況」を、実装と突き合わせる。API のパスと項目、入力の制約、テーブル、画面の項目と文言、バージョン、コマンド、リンク。**「文書に書いていない実装済みの機能」と、「実装していないのに書いてある機能」の両方**を探す
- **公開リポジトリとしての確認**（CLAUDE.md 第4章）
  - パスワード・キー・個人情報が、コミットされていないか（履歴も：`git log -p -S` など）。`.env`・`*.sql`・`*.dump`・`.claude/settings.local.json` が追跡されていないか（`git ls-files`）。`.claude/settings.json` は、コミットしてよいが、中身に秘密・個人情報・自分の PC のパスがないか、読んで確かめる
  - サンプルデータ、テスト、文書、`prototype/` に、実在の会社名・人名・依頼内容がないか
  - 画像・フォントのライセンスと出典が、`CREDITS.md` にあるか
  - スクリーンショットや録画に、IP アドレス・アカウント ID が映っていないか
- **画面の動作確認**（ユーザーと一緒に。実際の画面で）：`docs/requirements.md` の受け入れ条件・ユースケースを、1つずつ操作して確かめる。**見た目や、ブラウザでしか分からないことは、「ユーザーの確認が必要」と書く**

### 2. 静的チェックとテストを実行する（CLAUDE.md 第5章の表と同じ）
| 対象 | コマンド | 場所 |
|---|---|---|
| バックエンドのテスト（MySQL の起動が必要） | `uv run pytest` | `backend/` |
| バックエンドの静的チェック | `uv run ruff check .` | `backend/` |
| バックエンドの整形の確認 | `uv run ruff format --check .` | `backend/` |
| マイグレーションの往復 | `uv run alembic upgrade head` → `downgrade -1` → `upgrade head`（開発用 DB で。データが消えうる列の変更に注意） | `backend/` |
| 画面のテスト | `npm.cmd run test` | `frontend/` |
| 画面の静的チェック | `npm.cmd run lint` | `frontend/` |
| 画面の整形の確認 | `npm.cmd run format:check` | `frontend/` |
| 画面のビルド（型チェックを含む） | `npm.cmd run build` | `frontend/` |
| 部品の脆弱性 | `npm.cmd audit`、`npm.cmd audit --omit=dev`（本番に入る部品だけ） | `frontend/` |

**Terraform の点検**（`terraform/` で。CI の `terraform` ジョブと同じ内容。AWS には、つながない。道具の版は、`ci.yml` の `TERRAFORM_IMAGE`・`TFLINT_IMAGE`・`TRIVY_IMAGE` と合わせる）：

| 対象 | コマンド | 注意 |
|---|---|---|
| 書式 | `terraform fmt -check ec2.tf main.tf outputs.tf rds.tf security_groups.tf variables.tf vpc.tf`（**`.tf` ファイルを指定する**） | **引数なしや `-diff` は、`terraform.tfvars`（自分の IP と DB のパスワード）も対象になり、中身が画面に出る**。使わない |
| 文法 | `terraform init -backend=false` → `terraform validate` | AWS にはつながない（部品の取得だけ、ネットに出る） |
| 書き方（tflint） | Docker で使い捨て：`docker run --rm -v <コピー先>:/work -w /work --entrypoint sh ghcr.io/terraform-linters/tflint:v0.65.0 -c "tflint --init && tflint"` | 設定は `.tflint.hcl`（プラグインの版を固定） |
| セキュリティ（trivy） | Docker で使い捨て：`docker run --rm -v <コピー先>:/work -w /work aquasec/trivy:0.76.1 config . --ignorefile /work/.trivyignore --exit-code 1` | **`--ignorefile` は、絶対パス**（相対だと「見つからない」）。`create_database` が false のときは、RDS を調べないので、**true にしたとき**（ダミーの値を書いたファイルを `--tf-vars` で渡す）も、もう1回実行する |

- **`terraform.tfvars` は、道具に読ませない。** `.tf`・`user_data.sh`・`.tflint.hcl`・`.trivyignore`・`.terraform.lock.hcl` だけを、スクラッチパッドの一時フォルダにコピーして実行する（ダミーの値：`my_ip = "203.0.113.10/32"`、`db_password = "dummy-password-1234"`、`create_database = true`）。PC には、道具を入れない
- **空振りに注意（「成功」が、道具の働きを意味しない）。** Git Bash の `$PWD`（`/c/Users/...` の形）を Docker に渡すと、**空のフォルダを調べて、fmt・validate・tflint が「成功」と出る**。**`$(pwd -W)`（`C:/Users/...` の形）を使い、`ls` で中身が見えていることを、先に確かめる**。さらに、(1) trivy は、無視リスト（`.trivyignore`）を外すと、既知の件数（6件）が出るか、(2) tflint は、プラグインが入ったか（`Installed "aws"`）、で、道具が働いていることを確かめる。可能なら、**わざと壊して失敗するか**も確かめる（整形を崩す、存在しない変数、型のない変数、入口を `0.0.0.0/0`）
- Docker Desktop が起動していること。Bash で Windows のパスを渡すときは、`MSYS_NO_PATHCONV=1` を付ける
- trivy の指摘は、**「この設定が意図したものか」を、設計の前提（学習用で、数時間だけ動かして、使い終わったら destroy）と照らして**判断する。意図したものは、`.trivyignore` に、理由つきで書く（足すだけで CI は通るので、足す前に、本当に対応しなくてよいかを考える）。本物のデータを置くなら、バックアップ・削除の保護・ログは、対応が必要、と記録に書く
- **`terraform plan` は、AWS の読み取りと、値が要る。** 点検では、使うなら、先にユーザーに伝える。**`apply` と `destroy` は、点検では実行しない**（CLAUDE.md 第5章）。`plan` の結果を保存するときは、名前を `*.tfplan` にする（`-out=tfplan` は、`.gitignore` の対象外）
- **公開リポジトリとしての確認**（実行して確かめる）：`git ls-files` に、`*.tfstate`・`terraform.tfvars`・`*.tfplan`・秘密鍵・`.env` がないこと。履歴（`git log --all --diff-filter=A --name-only`）にも、ないこと。`git check-ignore -v` で、`.gitignore` が効いていること。追跡ファイルに、IP アドレス・12桁の数字（アカウント ID の疑い）がないこと

- 手元の `npm run format`（全体の整形）は、Windows の CRLF のため、無関係なファイルまで変える。**点検では、整形の確認だけ**を行う
- MySQL は Docker（`docker compose up -d db`）。ポートは固定（API 8000、MySQL 3306、画面 5173）。**起動前に使用中か確認し、無関係なプロセスは止めない**
- ひっかかったものは、(1) 挙動を変えずに直す、(2) 理由を書いて、その行だけ除外する、(3) 規則を外す（理由を記録する）のどれかにする。挙動が変わる直し方は、別の課題にする。除外には、必ず理由を書く
- 新しい検査（型の厳しさ、カバレッジ、アクセシビリティの自動検査など）を足すときは、まず現状の違反の数と中身を測り、**ゆるい規則から始める**。足すかどうかは、ユーザーの判断を待つ（点検の PR には混ぜない）

### 3. 結果を記録する
`docs/quality-review.md` に、次の形で書く。
- 点検の方法と結果の要約（実行したコマンドと、テスト・lint の件数）
- 指摘の表：バックエンド（B1…）、画面（F1…）、文書（D1…）、公開リポジトリ（P1…）。列は「ID・重大度・場所・指摘・推奨・判断」。**判断の欄は、ユーザーが決めるまで空にする**。「読んで見つけた」か「動かして確かめた」かも書く
- 良かった点
- 文書と実装のずれ（直したものと、直していないもの）
- 確認できていないこと（正直に書く）
- **Terraform の点検は、`docs/quality-review.md` に、新しい章として足す**（例：9 章）。(1) 自動チェックの表（道具・版・結果。ダミーの値で調べたこと、tfvars を読ませていないこと）、(2) trivy の指摘を、対応しない理由つきの表に（ID は、道具が付けた ID）、(3) 公開リポジトリとしての確認の表、(4) 実際のデプロイで分かったこと（T1…。確かめ方と、対応済みか未対応か）、(5) 実際に確かめられたこと（デプロイ・destroy の結果）、(6) まだ確かめていないこと。**直すのは、別の Issue・PR**。小さな指摘は、1つの目的にまとめてよい。CI への追加など、仕組みを変えるものは、別にする

あわせて、`notes/` の学習ノートに学びを追記し（`notes/README.md` の表も更新）、文書を直したら、CLAUDE.md 第6章どおり、同じ PR で README・仕様書をそろえる。

### 4. 文書を直す
- Markdown のリンク切れを、機械的に確認する（`docs/`、各 README、`notes/`、`CLAUDE.md`、`CREDITS.md`）
- **改行コードに注意**：このリポジトリの Markdown は、CRLF のものがある。複数行を置換するときは、改行を考慮する
- 書き換えた記述は、実装の該当箇所（ファイル:行）と、もう一度突き合わせる

### 5. PR を作る
- CLAUDE.md 3.5 のとおり：本文に `## 内容`、`## 確認したこと`、`Closes #番号`、「ユーザーの確認が必要」なこと、`Generated with Claude Code` の行
- 確認したことには、**実行した結果**だけを書く（lint の件数、テストの件数、ビルドの成否、リンク切れの数）。確かめていないことを、確認済みと書かない
- 「設計書が正」のものなど、別の課題は、先に Issue を作ってから、PR の本文で触れる
- **Terraform の点検の PR の「確認したこと」**：`terraform fmt -check`（`.tf` を指定）・`validate`・tflint・trivy の結果（件数。**CI と同じ版の道具**で）。実際の `terraform.tfvars` を、道具に読ませていないこと。文書の差分に、IP・パスワード・接続先の名前が入っていないこと。**確認できていないこと**（例：AWS に何もないので、`plan` で差分を確かめていない）。CI の `terraform` ジョブの結果（**必須チェック**。✗ のときは、直してから、ユーザーに確認を頼む）

## 点検のあと
- ユーザーが、記録の「判断」欄を決める（直す／直さない／あとで、と優先度）
- 直すと決めたものは、**1つずつ別の Issue・PR**にする。小さな指摘は、1つの目的にまとめてよい。直ったら、記録に「対応済み（PR 番号）」と書く
- CI（GitHub Actions）、カバレッジ、アクセシビリティの自動検査などの道具の追加は、別の Issue で相談する。CI を作ったら、必須チェックにするかを相談して、CLAUDE.md 3.7 に書く
- Terraform の点検は、2026-11-11 に実施（Issue #141。結果は `docs/quality-review.md` の 9 章、学びは学習ノート 42）。手順は、このスキルの Terraform の節に足した（Issue #149）。1本目の `quality-check` スキルの Terraform の節も、参考になる。CI の `terraform` ジョブは、必須チェックにしている（CLAUDE.md 3.7）

## 次回に向けて
- 前回の記録（`docs/quality-review.md`）の「判断」欄を見て、直すと決めたものが直っているか、先に確かめる
