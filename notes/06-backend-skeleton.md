# バックエンドの骨組み（uv・FastAPI・MySQL・pytest・ruff）

## 作ったもの
| 場所 | 中身 |
|---|---|
| `backend/app/main.py` | FastAPI のアプリ。動作確認用の `GET /health` だけある |
| `backend/tests/test_health.py` | `/health` のテスト（pytest） |
| `backend/pyproject.toml` | 使う部品の一覧と、pytest・ruff の設定 |
| `backend/uv.lock` | 実際に入った部品のバージョンの記録（同じ環境を再現するため） |
| `docker-compose.yml` | PC で開発するときの MySQL を、Docker で起動する設定 |
| `.env.example` | パスワードなどの見本。本物は `.env`（コミットしない） |

## 学んだこと
- **uv**：Python 本体の導入、部品の管理、仮想環境（そのプロジェクト専用の部品置き場 `.venv`）を、1つの道具でできる。`uv add 部品名` で入れ、`uv run コマンド` で、その環境の中で動かす
- **FastAPI の起動**：`uvicorn`（サーバー本体）が、`app.main:app`（`app/main.py` の中の `app`）を動かす。起動したままで、ブラウザや `Invoke-RestMethod` からつなげる
- **Docker で MySQL**：自分の PC に MySQL を直接入れず、コンテナ（箱）の中で動かす。壊しても作り直せるし、`docker compose down -v` でデータごと消せる。データは `db-data`（ボリューム）に残る
- **ポートを `127.0.0.1` に限定**：`ports: "127.0.0.1:3306:3306"` と書くと、自分の PC からだけつなげる。同じネットワークの他の人からは見えない
- **MySQL 8.4 は LTS**：長く保守される版。AWS の RDS も 8.4 に対応しているので、本番と開発で同じ版にそろえられる
- **`.env` と `.env.example`**：パスワードは `.env` に書いて、コミットしない。`.env.example` は、書き方の見本だけをコミットする

## つまずいたこと
- **PowerShell の `rp`**：自分で作った関数名 `rp` が、PowerShell 標準の命令の別名（`Remove-ItemProperty`）と重なって、パスワードが空になった。→ 関数名を `New-Pw` に変えた。MySQL は、空のパスワードでは起動しなかった
- **PowerShell 5.1 の `Set-Content -Encoding utf8`**：ファイルの先頭に BOM（目に見えない印）が付き、`pyproject.toml` が読めなくなった。→ BOM なしで書き直した
- **サーバーを止めたつもりで残っていた**：`uv` を止めても、その子プロセスの uvicorn が 8000 番を持ったままだった。止める前に、コマンドラインを見て、自分が起動したものか確かめた
