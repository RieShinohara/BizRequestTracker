# API 設計

画面（Vue）が、バックエンド（FastAPI）に頼むときの「窓口」を決める。要件は [requirements.md](requirements.md)、保存するデータは [データ設計](data-model.md)、操作の流れは [ユースケース](use-cases.md) を参照。
決まっていないことが出たら、ユーザーに確認してから、この文書を更新する。

**状態：下書き。「要確認」と書いた所は、Claude Code が補った点で、ユーザーの確認が済んでいない。**

## 1. 全体の決まり（ユーザーと決めた）
| 決めごと | 内容 |
|---|---|
| 作り方 | REST。表（依頼・依頼者・カテゴリー…）ごとに、窓口を作る。URL は `/api/...`、やり取りは JSON |
| 検索・絞り込み・並び替え | **サーバー側**で行う。条件は、URL の後ろの `?q=...&qms=true` のように付ける。窓口は増やさない |
| 並び替え | `sort` を付けない＝手動の並び。優先度・期限日・ステータスの順は、サーバーが決まった順番で並べる（文字の五十音順ではない）。同じ値どうしは、手動の並びのまま |
| 進み具合・期限の色 | **サーバーが計算**して、一覧に入れて返す。祝日の判定と会社の休みは、サーバー側の1か所（設定ファイル）に置く |
| 依頼の更新 | 変えたい項目だけ送る `PATCH`。アーカイブの切り替えも、これで行う |
| チェックリストの保存 | 依頼の追加・更新に、**チェックリスト全体を入れて送る**。送った一覧が、そのままチェックリストになる（「保存」で一度に反映する流れに合わせた） |
| 依頼者の登録 | 新しい名前は、先に `POST /api/requesters` で登録し、返ってきた `id` で依頼を保存する（2段階） |
| エラー | 404（見つからない）、409（今の状態ではできない）、422（入力が正しくない）。理由は `{"detail": "..."}` |

ステータスと優先度は、DB と同じ日本語の文字で送る。
- ステータス：`未着手`・`作業中`・`確認待ち`・`完了`・`ペンディング`
- 優先度：`急ぎ`・`高`・`中`・`低`

日付は `2026-11-05` の形（年-月-日）で送る。

## 2. 窓口の一覧
| 窓口 | 内容 | 状態 |
|---|---|---|
| `GET /api/requests` | 依頼の一覧（検索・絞り込み・並び替え） | 決定 |
| `GET /api/requests/{id}` | 依頼1件（詳細モーダル用。チェックリストの中身つき） | 要確認 |
| `POST /api/requests` | 依頼の追加 | 決定 |
| `PATCH /api/requests/{id}` | 依頼の更新（ステータス変更、アーカイブ、詳細モーダルの保存） | 決定 |
| `DELETE /api/requests/{id}` | 依頼の完全な削除（アーカイブ中だけ） | 決定 |
| `PUT /api/requests/order` | 手動の並びの保存 | 決定 |
| `GET /api/summary` | 画面上部の件数 | 要確認 |
| `GET /api/confirm-targets` | 確認先の候補 | 決定 |
| `GET /api/requesters` | 依頼者の一覧 | 要確認 |
| `POST /api/requesters` | 依頼者の追加 | 決定 |
| `PATCH /api/requesters/{id}` | 依頼者の名前・内線番号の変更 | 決定 |
| `GET /api/categories` | カテゴリーの一覧 | 要確認 |
| `POST /api/categories` | カテゴリーの追加 | 要確認 |
| `PATCH /api/categories/{id}` | カテゴリーの名前の変更 | 要確認 |
| `DELETE /api/categories/{id}` | カテゴリーの削除（使っていないものだけ） | 要確認 |
| `GET /api/categories/{id}/template-items` | カテゴリーのテンプレート項目の一覧 | 要確認 |
| `PUT /api/categories/{id}/template-items` | テンプレート項目を、送った一覧に入れ替える | 要確認 |

チェック項目だけの窓口と、「テンプレートを入れる」専用の窓口は作らない。「テンプレートを入れる」は、画面が `GET .../template-items` で項目を取り、チェックリストに足す（同じ名前は重ねない判断は、画面側）。

## 3. 依頼（requests）

### 3.1 一覧：`GET /api/requests`
条件（すべて省略できる。組み合わせられる）：
| 条件 | 内容 |
|---|---|
| `q` | キーワード。タイトル、詳細、依頼者の名前、確認先に含まれるものを探す |
| `qms` | `true` なら QMS の依頼だけ |
| `category_id` | そのカテゴリーの依頼だけ |
| `status` | そのステータスの依頼だけ |
| `include_archived` | `true` なら、アーカイブ中も含める（省略時は含めない） |
| `sort` | `priority`（急ぎ→高→中→低）、`due_on`（期限日の早い順）、`status`（未着手→作業中→確認待ち→完了→ペンディング）。省略すると手動の並び |

返すもの：依頼の配列。1件は次の項目を持つ。
```json
{
  "id": 9,
  "title": "（架空）通関書類の作成",
  "requester": {"id": 2, "name": "（架空）山田"},
  "category": {"id": 4, "name": "通関"},
  "status": "作業中",
  "priority": "高",
  "confirm_to": null,
  "due_on": "2026-11-10",
  "qms": true,
  "archived": false,
  "checklist_done": 3,
  "checklist_total": 11,
  "due_level": "soon"
}
```
- `due_level`：`"overdue"`（期限切れ・赤）、`"soon"`（3営業日以内・オレンジ）、`null`（色なし）。完了・ペンディング・アーカイブ中は、常に `null`
- `checklist_total` が 0 のとき、画面は進み具合を出さない
- 詳細、受付日、内線番号、チェックリストの中身は、一覧には入れない（詳細で返す）

### 3.2 1件：`GET /api/requests/{id}`（要確認）
一覧の項目に加えて、`description`、`received_on`、`requester.extension`（内線番号）、`checklist_items`（`[{"name": "...", "done": false}]`、順番どおり）を返す。見つからなければ 404。

### 3.3 追加：`POST /api/requests`
| 項目 | 必須 | 補足 |
|---|---|---|
| `title` | ○ | 空は 422 |
| `requester_id` | ○ | 登録済みの依頼者の番号 |
| `category_id` | ○ | |
| `due_on` | ○ | |
| `description` | | |
| `received_on` | | 省略すると今日 |
| `status` | | 省略すると `未着手` |
| `priority` | | 省略すると `中` |
| `confirm_to` | | |
| `qms` | | 省略すると `false` |
| `checklist_items` | | `[{"name": "...", "done": false}]`。省略すると空 |

- 新しい依頼は、手動の並びの**いちばん上**に入る
- 成功すると 201 と、`GET /api/requests/{id}` と同じ内容を返す

### 3.4 更新：`PATCH /api/requests/{id}`
追加と同じ項目のうち、**送った項目だけ**が変わる（`archived` も送れる）。`checklist_items` を送ったときは、送った一覧が、そのままチェックリストになる。成功すると 200 と、更新後の内容（`GET /api/requests/{id}` と同じ）を返す。
- 一覧のステータス変更：`{"status": "確認待ち", "confirm_to": "薬事部"}`
- アーカイブ：`{"archived": true}`、元に戻す：`{"archived": false}`
- `confirm_to` は、ステータスが「確認待ち」でなくなっても**消さない**（データ設計のとおり）

### 3.5 削除：`DELETE /api/requests/{id}`
- アーカイブ中の依頼だけ消せる。アーカイブ中でなければ 409（`{"detail": "アーカイブ中の依頼だけ削除できます"}`）
- チェックリストも一緒に消える。成功すると 204（中身なし）

### 3.6 並びの保存：`PUT /api/requests/order`
```json
{"ids": [5, 2, 9, 1]}
```
- 送った順に、手動の並びを振り直す
- `ids` は、**アーカイブ中を除く全依頼の番号**を、並べたもの。アーカイブ中の依頼の並びは変わらない
- 過不足があるとき（別の画面で依頼が増減したなど）は 409（`{"detail": "一覧が古くなっています。開き直してください"}`）（要確認）
- 成功すると 204

## 4. 件数：`GET /api/summary`（要確認）
```json
{
  "status_counts": {"未着手": 3, "作業中": 5, "確認待ち": 2, "完了": 8, "ペンディング": 1},
  "urgent_count": 2
}
```
- `status_counts`：アーカイブ中は数えない
- `urgent_count`：優先度が「急ぎ」の依頼の数。アーカイブ中と完了は数えない
- 条件（検索・絞り込み）の影響は受けない（画面全体の件数）

## 5. 確認先の候補：`GET /api/confirm-targets`
文字の配列を返す。
```json
["依頼者", "薬事部", "開発部", "営業部", "工場", "（架空）品質保証課"]
```
- 先頭は、最初の候補（依頼者、薬事部、開発部、営業部、工場）。**設定ファイル**に書く
- そのあとに、依頼の `confirm_to` に入っている文字（アーカイブ中の分も含む）が続く。同じ文字は重ねない
- 追加・削除の窓口は作らない

## 6. 依頼者（requesters）
| 窓口 | 内容 |
|---|---|
| `GET /api/requesters` | `[{"id": 2, "name": "...", "extension": "1234"}]`。名前順（要確認） |
| `POST /api/requesters` | `{"name": "...", "extension": "..."}`（`extension` は省略できる）。201 で、作った依頼者を返す |
| `PATCH /api/requesters/{id}` | 名前や内線番号を、送った項目だけ変える。直した内線番号は、その人の他の依頼にも反映される |

- 同じ名前は登録できない（409）。削除の窓口は作らない（依頼が使っているため）
- `extension` は、先頭の 0 を守るため、**文字**で送る

## 7. 業務カテゴリー（categories）とテンプレート（要確認）
| 窓口 | 内容 |
|---|---|
| `GET /api/categories` | `[{"id": 4, "name": "通関", "request_count": 7}]`（`request_count` は、そのカテゴリーを使っている依頼の数。削除できるかの目安に使う） |
| `POST /api/categories` | `{"name": "..."}`。201。同じ名前は 409 |
| `PATCH /api/categories/{id}` | 名前の変更。同じ名前は 409 |
| `DELETE /api/categories/{id}` | 依頼が1件でも使っていたら 409。消すと、そのカテゴリーのテンプレート項目も消える。204 |
| `GET /api/categories/{id}/template-items` | `[{"name": "原稿の確認"}, ...]`（テンプレートの順番どおり） |
| `PUT /api/categories/{id}/template-items` | `{"items": [{"name": "..."}, ...]}`。送った一覧が、そのままテンプレートになる（追加・編集・削除を、「保存」で一度に反映する） |

- 新しいカテゴリーの作成（UC-10）は、`POST /api/categories` のあと、`PUT .../template-items` でテンプレートを入れる
- すでにある依頼のチェックリストは、テンプレートを直しても変わらない

## 8. ユースケースとの対応
| ユースケース | 使う窓口 |
|---|---|
| UC-1 依頼の追加 | `GET /api/categories`、`GET /api/requesters`、`POST /api/requesters`（新しい人のとき）、`GET .../template-items`、`POST /api/requests`、`GET /api/summary` |
| UC-2 依頼の内容を直す | `GET /api/requests/{id}`、`PATCH /api/requests/{id}`、`PATCH /api/requesters/{id}`（内線番号） |
| UC-3 ステータスの変更 | `GET /api/confirm-targets`、`PATCH /api/requests/{id}`、`GET /api/summary` |
| UC-4 検索・絞り込み | `GET /api/requests`（`q`、`qms`、`category_id`、`status`、`include_archived`） |
| UC-5 並びの変更 | `GET /api/requests`（`sort`）、`PUT /api/requests/order` |
| UC-6 期限の確認 | `GET /api/requests`（`due_level`）、`GET /api/summary` |
| UC-7 テンプレートを入れる | `GET .../template-items`、`PATCH /api/requests/{id}`（`checklist_items`） |
| UC-8 項目を足す | `PATCH /api/requests/{id}`（`checklist_items`） |
| UC-9 テンプレートの編集 | `GET`・`PUT .../template-items` |
| UC-10 カテゴリーの管理 | `GET`・`POST`・`PATCH`・`DELETE /api/categories` |
| UC-11 アーカイブ | `PATCH /api/requests/{id}`（`archived`）、`GET /api/requests`（`include_archived`） |
| UC-12 完全な削除 | `DELETE /api/requests/{id}` |
