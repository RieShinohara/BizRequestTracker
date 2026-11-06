# DB接続とテーブル作成（SQLAlchemy・Alembic）

## 作ったもの
| 場所 | 中身 |
|---|---|
| `backend/app/config.py` | `.env` の `MYSQL_*` から、DB の接続先を組み立てる |
| `backend/app/db.py` | DB への接続（engine）と、会話の窓口（Session）。モデルの土台 `Base` |
| `backend/app/models.py` | 5つの表を、Python のクラス（モデル）として書いたもの |
| `backend/migrations/` | Alembic。表を作る「変更の履歴」（マイグレーション）を置く |
| `backend/migrations/versions/0001_create_tables.py` | 最初のマイグレーション。5つの表を作る（`upgrade`）／消す（`downgrade`） |
| `backend/tests/test_models.py` | 表・初期値・必須・重複なし・削除の動きのテスト |

## 学んだこと
- **SQLAlchemy（ORM）**：表を Python のクラスで書く。`Request` クラス ＝ `request` 表、クラスの1つのオブジェクト ＝ 表の1行。SQL を直接書かなくても、DB を読み書きできる
- **モデルとマイグレーションの違い**：モデルは「あるべき姿」の定義。マイグレーションは「今の DB を、そこに近づける手順の記録」。DB の変更は、直接いじらず、必ずマイグレーションで行う（履歴が残り、`downgrade` で戻せる）
- **autogenerate**：モデルと今の DB の差から、マイグレーションを自動で作ってくれる。ただし、できたファイルは**必ず中身を読む**（意図と違う変更が混ざることがある）
- **外部キーと削除時の動き**（data-model.md のとおり）
  - 依頼が使っている依頼者・カテゴリー：`RESTRICT`（削除しようとするとエラー）
  - カテゴリーを消す → テンプレート項目も消える、依頼を消す → チェック項目も消える：`CASCADE`（DB が一緒に消す）
- **初期値は2種類**：`server_default`（DB が入れる。`未着手` など）と、`default`（Python 側が入れる。受付日の「今日」）。「今日」は、日々変わるので、Python 側で入れる
- **テストは、テスト専用の DB で**：開発用のデータを壊さないよう、`biz_request_tracker_test` を作ってテストし、終わったら消す。表は Alembic で作るので、マイグレーション自体のテストにもなる。1テストごとに rollback して、テスト同士が影響しあわないようにした
- **接続先を `.env` から組み立てる**：パスワードをコードやコミットに入れないため。特殊な文字が入っても壊れないよう、文字列でなく `URL.create` で組み立てた

## つまずいたこと
- **PowerShell を通すと、`docker compose exec ... sh -c "..."` の引数が崩れる**：SQL の `SHOW TABLES;` が `SHOW` だけになった。→ SQL は、パイプ（`"SHOW TABLES;" | docker ... mysql`）で渡す
