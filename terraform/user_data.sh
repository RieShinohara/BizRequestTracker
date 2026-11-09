#!/bin/bash
# =============================================================
# サーバーの起動時に、1回だけ、自動で実行される命令（user_data）。root の権限で動く。
# 実行の様子は、サーバーの中の /var/log/cloud-init-output.log に残る。
#
# アプリを動かすための道具を入れる（アプリ本体は、ここでは置かない。手元でビルドして、あとから送る）。
#   ① nginx（Web サーバー）：画面を配信し、/api を、バックエンド（8000番）へ中継する
#   ② uv（Python の管理の道具）：Python 3.13 と、バックエンドの部品を入れる。アプリを置くときに使う
# Java も Node.js も、要らない（画面は、手元でビルドする）。
# =============================================================

# -e：失敗したら、そこで止める　-u：未定義の変数を使ったら止める　-x：実行した命令を、ログに出す
# -o pipefail：パイプ（|）でつないだ命令の途中の失敗も、見逃さない
set -euxo pipefail

# nginx を入れる（Amazon Linux 2023 の標準の部品置き場にある）
dnf install -y nginx

# 今すぐ起動する。サーバーを再起動しても、自動で起動するようにも設定する
systemctl enable --now nginx

# uv を入れる。手元で使っている版（0.13.7）に、そろえる。
# 版を決めた URL から取ってくるので、あとで、中身が変わらない。
# UV_INSTALL_DIR：全員が使える場所（/usr/local/bin）に入れる　UV_NO_MODIFY_PATH：設定ファイルを書き換えない
curl -LsSf https://astral.sh/uv/0.13.7/install.sh | env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh
