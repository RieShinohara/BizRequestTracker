#!/bin/bash
# EC2 の中で、「アプリを置いて、動かす」までを、まとめて行う（deploy/README.md の手順 3）。
# 使い方（bundle.tgz を、~/bundle に展開した場所で）：  bash deploy/setup.sh <RDS のアドレス>
# 前提：~/bundle の中に、backend/・deploy/・dist/ があること。
# DB のパスワードは、実行中に入力する（画面に出ず、ファイルにも履歴にも残らない。リポジトリにも書かない）。
set -euo pipefail

RDS_HOST="${1:?使い方: bash deploy/setup.sh <RDS のアドレス>}"
cd "$(dirname "$0")/.."

# Windows の改行（CRLF）が混ざっていても、Linux 用（LF）にそろえる
sed -i 's/\r$//' deploy/bizrequesttracker.service deploy/nginx-bizrequesttracker.conf deploy/seed_demo.py

echo "== バックエンドを置く =="
sudo mkdir -p /opt/bizrequesttracker/backend
sudo chown -R ec2-user: /opt/bizrequesttracker
cp -r backend/. /opt/bizrequesttracker/backend/
(cd /opt/bizrequesttracker/backend && uv sync --no-dev) # Python 3.13 と部品が入る（数分）

echo "== 画面を置く =="
sudo rm -rf /usr/share/nginx/html/*
sudo cp -r dist/* /usr/share/nginx/html/

echo "== 接続情報を書く（パスワードは、画面に出ません）=="
read -r -s -p "DB のパスワード（terraform.tfvars に書いたもの）: " DBPW
echo
printf 'DATABASE_URL=mysql+pymysql://app_admin:%s@%s:3306/biz_request_tracker?charset=utf8mb4\n' "$DBPW" "$RDS_HOST" |
  sudo install -m 600 -o ec2-user /dev/stdin /etc/bizrequesttracker.env
unset DBPW

echo "== 表を作る（表と、初期データ＝7カテゴリーが、RDS にできる）=="
(
  cd /opt/bizrequesttracker/backend
  set -a
  . /etc/bizrequesttracker.env
  set +a
  .venv/bin/alembic upgrade head
)

echo "== 起動する =="
sudo cp deploy/bizrequesttracker.service /etc/systemd/system/
sudo cp deploy/nginx-bizrequesttracker.conf /etc/nginx/default.d/bizrequesttracker.conf
sudo nginx -t # 設定の文法チェック（ok と出ること）
sudo systemctl daemon-reload
sudo systemctl enable --now bizrequesttracker
sudo systemctl enable --now nginx
sudo systemctl reload nginx

echo "== 完了。次は、README の「確認する」へ（例：curl -s localhost/health）=="
