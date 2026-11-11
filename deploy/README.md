# deploy/：サーバー（EC2）の中に置く設定と、当日の手順書

AWS にアプリを置く日（デプロイ当日）の、**段階③「アプリを置く」** の手順。段階①②（ネットワーク・EC2・RDS を作る）は、[terraform/README.md](../terraform/README.md)。構成の全体は、[docs/infrastructure.md](../docs/infrastructure.md)。

> **この手順書は、2026-11-10 の実際のデプロイで使った流れ**を元にしている。Terraform は「入れ物」を作り、この手順は「アプリを置いて、動かす」（デプロイ）。

| ファイル | 役割 |
|---|---|
| `setup.sh` | EC2 の中で、アプリを置いて動かすまでを、まとめて行う（手順 3）。DB のパスワードは、実行中に入力する |
| `bizrequesttracker.service` | systemd の設定。バックエンド（uvicorn）を、裏で動かし続ける。落ちたら、自動で起動し直す（`/etc/systemd/system/` に置かれる） |
| `nginx-bizrequesttracker.conf` | nginx の設定。画面の配信と、`/api/`・`/health` の中継。`/docs` などは 404（`/etc/nginx/default.d/` に置かれる） |
| `seed_demo.py` | （任意）録画用に、架空の依頼を入れる |

**秘密は、ここに置かない。** DB のパスワードは、`setup.sh` の実行中に入力する（EC2 の中の `/etc/bizrequesttracker.env`、権限 600 に書かれる）。

## 前提
- 段階②まで終わっている（`create_database = true`。`terraform output` で、IP と RDS のアドレスが出る）
- **手元の PowerShell** で行う。`<IP>` は `terraform output public_ip`、`<RDS のアドレス>` は `terraform output rds_endpoint` の値。**IP とパスワードは、チャットに貼らない**
- SSH の秘密鍵は `~/.ssh/id_ed25519`。**鍵にパスフレーズをかけているときは、`ssh`・`scp` のたびに、入力が要る**（AI は代わりにできない。自分の PowerShell で行う）。そのため、**送る物は、1つのファイルにまとめる**（入力が1回で済む）
- 新しい PowerShell は、`terraform` フォルダにいない。値を取るときは `terraform -chdir=terraform output -raw public_ip` と書く。変数に入れると楽：
  ```powershell
  $ip = terraform -chdir=terraform output -raw public_ip
  # 使うとき： "ec2-user@${ip}"
  ```

## 手順

### 1. 手元で、1つのファイル（bundle.tgz）にまとめる
```powershell
cd frontend; npm.cmd ci; npm.cmd run build; cd ..        # 画面のビルド（Python は、ビルド不要）
& "$env:SystemRoot\System32\tar.exe" -czf $env:TEMP\bundle.tgz --exclude=.venv --exclude=tests --exclude=__pycache__ --exclude=.pytest_cache --exclude=.ruff_cache --exclude=.env --exclude=.coverage backend deploy -C frontend dist
```
- 中身は、`backend/`・`deploy/`・`dist/`（画面のビルド結果）。`.env` や `.venv` は、入れない（秘密と、手元専用の環境のため）
- **Windows 標準の `tar.exe` を、場所を指定して使う。** Git Bash の `tar` は、`C:` を「別のサーバー」と誤解する（使うなら `--force-local` が要る）

### 2. EC2 に送って、つなぐ
```powershell
scp -i ~/.ssh/id_ed25519 $env:TEMP\bundle.tgz ec2-user@${ip}:/tmp/
ssh -i ~/.ssh/id_ed25519 ec2-user@${ip}
```
初めてのつなぎでは、「このホストを信頼しますか」と聞かれる。`yes`。

### 3. EC2 の中で、置いて、動かす
```bash
cloud-init status --wait ; nginx -v ; uv --version     # 初回の準備（user_data）が終わっているか
mkdir -p ~/bundle && tar -xzf /tmp/bundle.tgz -C ~/bundle && cd ~/bundle
sed -i 's/\r$//' deploy/setup.sh                        # Windows の改行（CRLF）が混ざっていても動くように
bash deploy/setup.sh <RDS のアドレス>                    # 途中で、DB のパスワードを聞かれる（画面には出ない）
```
`setup.sh` が、次を順に行う：バックエンドを置く（`uv sync`）→ 画面を置く → 接続情報を書く → 表と初期データを作る（`alembic upgrade head`）→ systemd と nginx で起動する。

### 4. 確認する
EC2 の中：
```bash
systemctl status bizrequesttracker --no-pager     # active (running)
curl -s localhost/health                          # 動作確認用の応答
curl -s localhost/api/summary                     # 件数（最初は全部 0）
curl -s -o /dev/null -w "%{http_code}\n" localhost/docs          # 404
curl -s -o /dev/null -w "%{http_code}\n" localhost/openapi.json  # 404
ss -tln | grep 8000                               # 127.0.0.1:8000 だけ（0.0.0.0 ではない）
```
手元のブラウザ：`terraform output web_url` の URL を開く。一覧が出て、依頼を追加・保存できること。

つまずいたら：`journalctl -u bizrequesttracker -n 50 --no-pager`（バックエンドのログ）、`sudo tail /var/log/nginx/error.log`。

### 5. （任意）録画用に、架空の依頼を入れる
```bash
python3 ~/bundle/deploy/seed_demo.py     # 空の状態で、1回だけ。依頼9件・依頼者5人が入る
```
- **依頼が1件でもあると、止まる**（二重に入るのを防ぐ安全装置）。手で作った依頼は、先に消す
- 入れ直したいときは、`cd /opt/bizrequesttracker/backend && set -a; . /etc/bizrequesttracker.env; set +a; .venv/bin/alembic downgrade base && .venv/bin/alembic upgrade head` で、空に戻してから

## 片づけ（当日の最後に必ず）
手元で `terraform destroy`（先に、ユーザーが承認する）。そのあと、AWS に残っていないか確かめる（手順は、[terraform/README.md](../terraform/README.md)）。EC2 の中に入れたデータも、一緒になくなる。

次に作るときは、`terraform.tfvars` の `create_database` を、段階①のために `false` に戻し、`my_ip` が今の IP か確かめる。
