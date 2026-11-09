"""（任意）画面録画のために、架空の依頼を、API 経由で入れる。

- 依頼者・依頼の中身は、すべて架空。カテゴリーとテンプレートは、初期データを使う。
- 日付は、実行する日（日本時間）を基準に決める。期限の色が出るように、次のようにしている：
    赤（期限切れ）＝3日前、オレンジ（3営業日以内）＝翌日・翌々日、色なし＝それ以降／完了
- 使い方（EC2 の中で。標準の python3 だけで動く）：
    python3 seed_demo.py
  API が、127.0.0.1:8000 で動いていて、依頼者・依頼が、まだ1件もない状態で、1回だけ実行する。
  別の場所の API に入れるときは、環境変数 API_BASE で指定する（例：API_BASE=http://127.0.0.1:8000）
- 入れたデータは、AWS を消す（terraform destroy）と、なくなる。
"""

import json
import os
import urllib.request
from datetime import datetime, timedelta, timezone

BASE = os.environ.get("API_BASE", "http://127.0.0.1:8000")
JST = timezone(timedelta(hours=9))
TODAY = datetime.now(JST).date()


def day(offset: int) -> str:
    """今日から offset 日あとの日付（YYYY-MM-DD）。マイナスは、過去。"""
    return (TODAY + timedelta(days=offset)).isoformat()


def call(method: str, path: str, body=None):
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    with urllib.request.urlopen(request) as response:
        raw = response.read()
        return json.loads(raw) if raw else None


categories = {c["name"]: c["id"] for c in call("GET", "/api/categories")}
assert len(categories) == 7, (
    f"カテゴリーが7つありません（初期データが入っていない？）：{list(categories)}"
)
assert not call("GET", "/api/requests?include_archived=true"), (
    "すでに依頼があります。空の状態で実行してください"
)

# 依頼者（すべて架空。内線番号は、1人だけ空）
requesters = {}
for name, extension in [
    ("青木 一郎", "2101"),
    ("石井 花子", "2214"),
    ("上田 健", "3032"),
    ("遠藤 美咲", ""),
    ("大野 次郎", "4105"),
]:
    requesters[name] = call("POST", "/api/requesters", {"name": name, "extension": extension})["id"]


def checklist(category: str, done: int):
    """そのカテゴリーのテンプレートを、先頭から done 個だけ、チェック済みにして返す。"""
    items = call("GET", f"/api/categories/{categories[category]}/template-items")
    return [{"name": item["name"], "done": index < done} for index, item in enumerate(items)]


# 一覧の、上から下への並び順。新しい依頼は、いちばん上に入るので、下から順に作る
demo = [
    # 1 期限切れ（赤）・急ぎ・QMS。チェックリストは、途中まで
    dict(
        title="製品サイトの仕様表を更新",
        description="新型番の仕様表を追加する。",
        requester="青木 一郎",
        category="HP",
        status="作業中",
        priority="急ぎ",
        due_on=day(-3),
        received_on=day(-9),
        qms=True,
        items=("HP", 3),
    ),
    # 2 3営業日以内（オレンジ）・急ぎ・QMS
    dict(
        title="展示会向けの輸出書類を作成",
        requester="上田 健",
        category="通関",
        status="作業中",
        priority="急ぎ",
        due_on=day(2),
        received_on=day(-6),
        qms=True,
        items=("通関", 4),
    ),
    # 3 3営業日以内（オレンジ）・確認待ち（確認先つき）
    dict(
        title="製品紹介動画の編集",
        requester="石井 花子",
        category="動画",
        status="確認待ち",
        priority="高",
        due_on=day(1),
        received_on=day(-8),
        confirm_to="依頼者",
        items=("動画", 7),
    ),
    # 4 チェックリストが空（「テンプレートを入れる」を押して見せられる）
    dict(
        title="新製品の取扱説明書を作成",
        description="日本語版。画像は、既存のものを使う。",
        requester="遠藤 美咲",
        category="取扱説明書",
        status="未着手",
        priority="中",
        due_on=day(10),
        received_on=day(-5),
    ),
    # 5 確認待ち（確認先つき）
    dict(
        title="委員会の資料を確認",
        requester="大野 次郎",
        category="研究倫理委員会",
        status="確認待ち",
        priority="高",
        due_on=day(14),
        received_on=day(-7),
        confirm_to="薬事部",
        items=("研究倫理委員会", 2),
    ),
    # 6 チェックリストが空
    dict(
        title="新しいメンバーの AI アカウントを発行",
        requester="石井 花子",
        category="AIアカウント発行",
        status="未着手",
        priority="低",
        due_on=day(21),
        received_on=day(-5),
    ),
    # 7 ペンディング（色なし）
    dict(
        title="会社案内ページのバナーを差し替え",
        requester="青木 一郎",
        category="HP",
        status="ペンディング",
        priority="低",
        due_on=day(28),
        received_on=day(-12),
    ),
    # 8 完了（色なし）。チェックリストは、すべてチェック済み
    dict(
        title="旧版の紹介動画を整理",
        requester="上田 健",
        category="動画",
        status="完了",
        priority="中",
        due_on=day(-4),
        received_on=day(-14),
        items=("動画", 12),
    ),
]

for entry in reversed(demo):
    body = {
        "title": entry["title"],
        "requester_id": requesters[entry["requester"]],
        "category_id": categories[entry["category"]],
        "due_on": entry["due_on"],
        "received_on": entry["received_on"],
        "status": entry["status"],
        "priority": entry["priority"],
        "qms": entry.get("qms", False),
    }
    if "description" in entry:
        body["description"] = entry["description"]
    if "confirm_to" in entry:
        body["confirm_to"] = entry["confirm_to"]
    if "items" in entry:
        body["checklist_items"] = checklist(*entry["items"])
    call("POST", "/api/requests", body)

# アーカイブ済みの依頼を1件（「アーカイブも表示」の見せ場）。作ってから、アーカイブする
archived = call(
    "POST",
    "/api/requests",
    {
        "title": "旧パンフレットの文言を修正",
        "requester_id": requesters["遠藤 美咲"],
        "category_id": categories["取扱説明書"],
        "due_on": day(-20),
        "received_on": day(-30),
        "status": "完了",
        "priority": "中",
    },
)
call("PATCH", f"/api/requests/{archived['id']}", {"archived": True})

print(f"入れました：依頼 {len(demo) + 1} 件（アーカイブ 1 件を含む）、依頼者 {len(requesters)} 人")
