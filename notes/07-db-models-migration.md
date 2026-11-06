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

## 3つの言葉：マイグレーション・SQLAlchemy・Alembic

### マイグレーションとは
データベースの設計変更を、「手順書」にして、順番に実行できるようにしたもの。

- たとえ：家の設計図を直接書き換えず、「改築ごとに手順書を1枚ずつ作って、順番に並べておく」
- 実物：`migrations/versions/0001_create_tables.py` が、1枚目の手順書。`upgrade()` が表を**作る**（進める）、`downgrade()` が表を**消す**（戻す）
- 動き方：DB の中の `alembic_version` 表に、「何番まで実行したか」が1行だけ記録される

| コマンド | やること |
|---|---|
| `alembic upgrade head` | まだ実行していない手順書を、順番に実行する |
| `alembic downgrade -1` | 1つ前に戻す |
| `alembic current` | 今、何番か |

- 必要な理由：①DB を直接いじると、記録が残らない ②自分の PC・テスト用 DB・AWS の RDS で、同じ状態を作れる ③戻せる ④変更の履歴が Git に残る
- 注意：**実行済みの手順書は書き換えない**（直すときは、新しい手順書を足す）。**モデルを変えただけでは、DB は変わらない**。`downgrade` で表を消すと、**中のデータも消える**

### SQLAlchemy：Python と DB の通訳
DB（MySQL）は SQL という別の言葉で話す。SQLAlchemy が、Python のコードを SQL に直して、結果を Python のオブジェクトに直してくれる（この仕組みを **ORM** という）。

```python
session.add(Request(title="書類の作成", due_on=date(2026, 12, 1), ...))   # ← これが
# INSERT INTO request (title, due_on, ...) VALUES (...)                   # ← こう伝わる
```

| 部品 | 場所 | 役割 |
|---|---|---|
| モデル | `app/models.py` | 表に対応するクラス。クラス1つ＝表1つ、オブジェクト1つ＝1行 |
| engine | `app/db.py` | MySQL との接続（電話回線のようなもの） |
| Session | `app/db.py` の `SessionLocal` | 保存・取得・削除をまとめて行う窓口 |

利点：SQL を毎回書かなくてよい。SQL インジェクション（悪意ある入力で DB を操作される攻撃）を防ぎやすい。MySQL 以外の DB にも、ほぼ同じコードで使える。

### Alembic：設計変更の記録係
SQLAlchemy は「表がある」前提でデータを読み書きする。**表そのものを作る・変える**のは Alembic の仕事。モデルを読んで、今の DB との差から手順書を自動で作れる（autogenerate）。

```
models.py（あるべき姿）
   │  alembic revision --autogenerate
   ▼
migrations/versions/0001_...py（手順書）
   │  alembic upgrade head
   ▼
MySQL に、実際の表ができる  ◀── アプリが SQLAlchemy の Session で読み書き
```

家のたとえ：設計図＝モデル、改築の手順書＝Alembic のマイグレーション、家で暮らす（物を出し入れする）＝SQLAlchemy の Session。

### 1本目（TaskManagement）との対応
| 役割 | 1本目（Java） | 今回（Python） |
|---|---|---|
| DB の読み書き（ORM） | JPA（Hibernate） | SQLAlchemy |
| 表の変更履歴 | Flyway | Alembic |

違い：Flyway は、手順書を **SQL で手書き**する（`V1`、`V2`…）。Alembic は、**Python で書き**、モデルから**自動生成**もできる（できたファイルは、中身を読んで確認する）。

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
