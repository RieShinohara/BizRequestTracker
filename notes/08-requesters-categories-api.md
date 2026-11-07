# 依頼者とカテゴリーの API

## 作ったもの
| 場所 | 中身 |
|---|---|
| `backend/app/routers/requesters.py` | 依頼者の窓口3本（一覧・追加・変更） |
| `backend/app/routers/categories.py` | カテゴリーの窓口4本（一覧・追加・変更・削除） |
| `backend/app/schemas.py` | 送る・受け取る JSON の形と、入力の確認（Pydantic） |
| `backend/app/deps.py` | 窓口ごとに DB の Session を貸し出す `get_db` |
| `backend/tests/test_requesters_api.py`、`test_categories_api.py` | 窓口ごとのテスト（23件） |

窓口の仕様は [docs/api-design.md](../docs/api-design.md) の「6」「7」のとおり。

## 学んだこと
- **ルーター（router）**：窓口を、表ごとのファイルに分けて書く仕組み。`main.py` で `include_router` して、まとめる
- **スキーマ（Pydantic）**：JSON の形を、クラスで書く。足りない項目や、長すぎる名前を、窓口に入る前に 422 で断ってくれる。モデル（`models.py`、DB の表）とは別物
  - モデル＝DB の形、スキーマ＝API の形。分けておくと、「DB の中身を、そのまま外に出してしまう」事故を防げる
- **Depends（依存の差し込み）**：窓口の引数に `db: Session = Depends(get_db)` と書くと、FastAPI が Session を用意して渡し、終わったら閉じてくれる。テストでは、これを差し替えられる
- **PATCH は「送った項目だけ」変える**：`model_fields_set`（送られた項目の名前の集まり）で見分ける。「送っていない」と「null を送った」は別。内線番号に null を送ると消せるが、名前に null は 422
- **重複は DB に判断させる**：「同じ名前があるか」を先に調べるのではなく、保存して、DB の「重複なし」の制約に断られたら 409 にする。調べてから保存するまでの間に、別の人が登録するすきまがないため
- **ステータスコードの使い分け**：作った＝201、消した＝204（本文なし）、見つからない＝404、今の状態ではできない（重複・使用中）＝409、入力が正しくない＝422
- **FastAPI の `/docs`**：窓口の一覧と、試し打ちができる説明画面が、コードから自動でできる
- **テストは「仮の保存」で**：API の中で `commit` しても、テストの最後に全部取り消す（`join_transaction_mode="create_savepoint"`）。テスト同士が影響しあわず、DB も汚れない

## 要件にない、私（Claude Code）が決めた点
- カテゴリーの一覧の順番は、登録順（id 順）。依頼者は設計どおり名前順
- 名前の前後の空白は取り除く。空白だけの名前は 422
- 内線番号を空の文字（`""`）で送ったら、「なし」（null）として保存する

## つまずいたこと
- **ruff が `Depends(...)` を警告した**（B008）：FastAPI の標準の書き方なので、設定で許可した（`extend-immutable-calls`）
- **確認用の PowerShell の関数が、5.1 にない指定で動かなかった**：結果が空に見えた。`/docs` が 200 だったので気づいた
