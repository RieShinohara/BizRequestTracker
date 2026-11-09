# deploy/：サーバー（EC2）の中に置く設定と、当日の手順書

AWS にアプリを置く日（デプロイ当日）の、**段階③「アプリを置く」** の手順。段階①②（ネットワーク・EC2・RDS を作る）は、[terraform/README.md](../terraform/README.md)。構成の全体は、[docs/infrastructure.md](../docs/infrastructure.md)。

| ファイル | EC2 の中の置き場所 | 役割 |
|---|---|---|
| `bizrequesttracker.service` | `/etc/systemd/system/` | バックエンド（uvicorn）を、裏で動かし続ける。落ちたら、自動で起動し直す |
| `nginx-bizrequesttracker.conf` | `/etc/nginx/default.d/bizrequesttracker.conf` | 画面の配信と、`/api/`・`/health` の中継。`/docs` などは 404 |
| `seed_demo.py` | （どこでもよい。一時的に送る） | （任意）録画用に、架空の依頼を入れる |

**秘密は、ここに置かない。** DB のパスワードを含む接続情報は、EC2 の中の `/etc/bizrequesttracker.env` に、手で書く。

## 前提
- 段階②まで終わっている（`create_database = true`。`terraform output` で、IP と `database_url_template` が出る）
- 手元の PowerShell（このリポジトリの直下）で、`<IP>` は、`terraform output public_ip` の値。**IP は、チャットに貼らない**
- SSH の秘密鍵は、`~/.ssh/id_ed25519`（`terraform output ssh_command` に、つなぎ方が出る）

## 手順

### 1. 手元で、成果物を作る（画面のビルド・バックエンドの梱包）
```powershell
cd frontend; npm.cmd ci; npm.cmd run build; cd ..
tar -czf $env:TEMP\backend.tgz --exclude=.venv --exclude=tests --exclude=__pycache__ --exclude=.pytest_cache --exclude=.ruff_cache --exclude=.env --exclude=.coverage -C backend .
```
- `.env` や `.venv` は、送らない（秘密と、手元専用の環境のため）

### 2. EC2 に送る
```powershell
scp -i ~/.ssh/id_ed25519 $env:TEMP\backend.tgz ec2-user@<IP>:/tmp/
scp -i ~/.ssh/id_ed25519 -r frontend\dist ec2-user@<IP>:/tmp/dist
scp -i ~/.ssh/id_ed25519 deploy\bizrequesttracker.service deploy\nginx-bizrequesttracker.conf deploy\seed_demo.py ec2-user@<IP>:/tmp/
```
初めてのつなぎでは、「このホストを信頼しますか」と聞かれる。`yes`。

### 3. EC2 の中で、置く（`ssh` でつなぐ）
```bash
# 初回の準備が終わっているか（user_data の完了。nginx と uv が入っている）
cloud-init status --wait ; nginx -v ; uv --version

# バックエンド
sudo mkdir -p /opt/bizrequesttracker/backend
sudo chown -R ec2-user: /opt/bizrequesttracker
tar -xzf /tmp/backend.tgz -C /opt/bizrequesttracker/backend
cd /opt/bizrequesttracker/backend && uv sync --no-dev        # Python 3.13 と部品が入る（数分）

# 画面
sudo rm -rf /usr/share/nginx/html/*
sudo cp -r /tmp/dist/* /usr/share/nginx/html/

# 接続情報（<パスワード> と <RDS のアドレス> は、自分で入れる。terraform output database_url_template が見本）
sudo install -m 600 -o ec2-user /dev/null /etc/bizrequesttracker.env
nano /etc/bizrequesttracker.env
#   中身は1行だけ：  DATABASE_URL=mysql+pymysql://app_admin:<パスワード>@<RDS のアドレス>:3306/biz_request_tracker?charset=utf8mb4
```

### 4. 表を作って、起動する
```bash
cd /opt/bizrequesttracker/backend
set -a; . /etc/bizrequesttracker.env; set +a
.venv/bin/alembic upgrade head          # 表と、初期データ（7カテゴリー）が、RDS にできる

sudo cp /tmp/bizrequesttracker.service /etc/systemd/system/
sudo cp /tmp/nginx-bizrequesttracker.conf /etc/nginx/default.d/bizrequesttracker.conf
sudo nginx -t                           # 設定の文法チェック（ok と出ること）
sudo systemctl daemon-reload
sudo systemctl enable --now bizrequesttracker
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

### 5. 確認する
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

### 6. （任意）録画用に、架空の依頼を入れる
```bash
python3 /tmp/seed_demo.py     # 空の状態で、1回だけ。依頼9件・依頼者5人が入る
```
入れ直したいときは、`alembic downgrade base` → `upgrade head` で空に戻してから。

## 片づけ（当日の最後に必ず）
手元で `terraform destroy`（先に、ユーザーが承認する）。そのあと、AWS に残っていないか確かめる（手順は、[terraform/README.md](../terraform/README.md)）。EC2 の中に入れたデータも、一緒になくなる。
