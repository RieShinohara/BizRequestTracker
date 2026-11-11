# terraform/

AWS に作る物（ネットワーク、サーバー、データベース）を、コードで書いたもの。構成の説明と構成図は、[docs/infrastructure.md](../docs/infrastructure.md)。

## ファイルの役割
| ファイル | 内容 |
|---|---|
| `main.tf` | Terraform と AWS 部品（provider）の版、地域、全部に付ける共通のタグ |
| `variables.tf` | 外から渡せる設定値（自分の IP、サーバーと DB の型、DB の名前・ユーザー・パスワード、RDS を作るかのスイッチ）と、入力のチェック |
| `vpc.tf` | ネットワーク（VPC、サブネット、インターネットへの玄関、経路） |
| `security_groups.tf` | 通信の許可（EC2 用、RDS 用） |
| `ec2.tf` | サーバー（EC2）と、SSH の公開鍵の登録 |
| `user_data.sh` | サーバーの起動時に、1回だけ実行する命令（nginx と uv を入れる） |
| `rds.tf` | データベース（RDS の MySQL）と、DB サブネットグループ。`create_database` が true のときだけ作る |
| `outputs.tf` | 作ったあとに表示する値（IP、URL、SSH のコマンド、DB の接続先の見本） |
| `terraform.tfvars` | **自分の値**（自分の IP、DB のパスワード）。**コミットしない** |
| `terraform.tfvars.example` | 上の見本（偽の値）。コピーして使う |
| `.terraform.lock.hcl` | 使う部品の版の記録（コミットする） |
| `.tflint.hcl` | tflint（書き方の点検）の設定 |
| `.trivyignore` | trivy（セキュリティの点検）の指摘のうち、「意図した設定なので、対応しない」と決めた物の一覧（理由つき） |

`terraform.tfstate`（Terraform が、作った物を覚えておくファイル）、`terraform.tfvars`、`*.tfplan` は、コミットしない（`.gitignore` で除外済み）。`terraform.tfstate` は、消さない。消すと、作った物を忘れてしまう。

## 使う前の準備
- AWS CLI と Terraform を入れて、AWS の認証を済ませておく
- `terraform.tfvars.example` を `terraform.tfvars` にコピーして、**自分の値に書き換える**：
  - `my_ip`：自分の PC のグローバル IP。IP が変わったら、ここを直して `apply` する
  - `db_password`：DB のパスワード。英数字と `_` `-` だけ、12〜41 文字
  - `create_database`：最初は `false`
- SSH の鍵（`~/.ssh/id_ed25519` と `.pub`）を作っておく。AWS に渡すのは、公開鍵（`.pub`）だけ

## 段階ごとに作る（`create_database` のスイッチ）
確認しながら、少しずつ作るため、RDS は、スイッチで、作る・作らないを切り替える。

| 段階 | `create_database` | 作る物 | 確認すること |
|---|---|---|---|
| ① | `false`（最初） | ネットワーク、セキュリティグループ、EC2 | EC2 が起動する／SSH でつながる／ブラウザで nginx のページが開く |
| ② | `true` に書き換えて `apply` | RDS（MySQL）が、足される | EC2 の中から、DB につながる／外からは、つながらない |
| ③ | （そのまま） | アプリを置く（Terraform の外。[docs/infrastructure.md](../docs/infrastructure.md) の 4） | 画面が開く／登録・テンプレートが動く |
| 最後 | `terraform destroy` | 全部消す | 消えたことの確認 |

## コマンド（`terraform/` で実行）
| やりたいこと | コマンド | 注意 |
|---|---|---|
| 準備（部品のダウンロード） | `terraform init` | 最初に1回 |
| 書式の確認／文法の検査 | `terraform fmt -check ` ＋ `.tf` のファイル名 ／ `terraform validate` | AWS には、何も作らない |
| 予告 | `terraform plan` | 何も作らない。何が作られるか、読んで確かめる |
| 作る | `terraform apply` | AWS に実際に作る。**費用がかかる物を含む。ユーザーが承認してから** |
| 消す（予告） | `terraform plan -destroy` | 何が消えるかを確かめる |
| 消す | `terraform destroy` | 作った物を全部消す。**RDS のデータも消える。ユーザーが承認してから** |
| 作ったあとの値 | `terraform output` | IP や接続先が出る。人に見せるときは、隠す |

- **`terraform fmt` は、`.tf` ファイルを指定して実行する**（例：`terraform fmt -check ec2.tf vpc.tf`）。引数なしだと、`terraform.tfvars`（自分の IP と DB のパスワード）も対象になり、`-diff` では、その中身が画面に出る。
- **予告の結果を、ファイルに保存するときは、名前の最後を必ず `.tfplan` にする**（例：`terraform plan -out=stage1.tfplan`）。`.gitignore` が除外するのは `*.tfplan` だけなので、`-out=tfplan`（拡張子なし）と書くと、除外されず、コミットされかける（デプロイ当日に、実際に起きた）。保存したファイルには、設定の値が含まれることがある。`git status` で、`.tfplan` が出ていないことを確かめる。
- **使い終わったら、`destroy` で消す。** 消したあとは、`terraform state list` が空か、AWS CLI の読み取り（`aws ec2 describe-instances` など）で、残っていないかを確かめる。

## 点検（手元で、使い捨ての Docker で行う例）
`terraform.tfvars` を渡さないように、`.tf` などだけを、一時フォルダにコピーして実行する。

```
mkdir ../tmp-scan && cp *.tf user_data.sh .tflint.hcl .trivyignore .terraform.lock.hcl ../tmp-scan/
docker run --rm -v "$PWD/../tmp-scan:/data" -w /data --entrypoint sh ghcr.io/terraform-linters/tflint:v0.65.0 -c "tflint --init && tflint --format compact"
docker run --rm -v "$PWD/../tmp-scan:/src:ro" aquasec/trivy:0.76.1 config --ignorefile /src/.trivyignore /src
rm -rf ../tmp-scan
```

- RDS は、スイッチが切れていると、trivy が調べない。調べるには、`create_database = true` のダミーの値を書いたファイルを作り、`--tf-vars` で渡す（秘密は、書かない）。
- CI への追加は、別の PR で行う。

## その他
- 秘密（アクセスキー、DB のパスワード、秘密鍵、アカウント ID）は、コミットしない・チャットに貼らない（[CLAUDE.md](../CLAUDE.md) の 4章）。
- 画面録画・スクリーンショットに、IP アドレスやアカウント ID が映らないようにする。
