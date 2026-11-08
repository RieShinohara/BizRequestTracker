from datetime import date

import pytest


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    """「今日」を、2026-11-20（金）に固定する（期限の色が、実行日で変わらないように）。"""
    monkeypatch.setattr("app.business_days.today", lambda: date(2026, 11, 20))


@pytest.fixture
def ids(client):
    requester = client.post("/api/requesters", json={"name": "山田 太郎（架空）"}).json()
    category = client.post("/api/categories", json={"name": "通関書類"}).json()
    return {"requester_id": requester["id"], "category_id": category["id"]}


def create(client, ids, title="依頼", **overrides):
    body = {"title": title, "due_on": "2026-12-01", **ids, **overrides}
    response = client.post("/api/requests", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def listing(client, **params):
    response = client.get("/api/requests", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def titles(client, **params):
    return [r["title"] for r in listing(client, **params)]


# ---- 一覧の中身 ----


def test_empty_list(client):
    assert listing(client) == []


def test_list_item_has_the_documented_fields_only(client, ids):
    create(client, ids, "（架空）通関書類の作成", due_on="2026-11-19", checklist_items=[
        {"name": "A", "done": True}, {"name": "B"}, {"name": "C"},
    ], qms=True, status="作業中", priority="高")  # fmt: skip
    (item,) = listing(client)
    assert set(item) == {
        "id", "title", "requester", "category", "status", "priority", "confirm_to",
        "due_on", "qms", "archived", "checklist_done", "checklist_total", "due_level",
    }  # fmt: skip
    assert item["requester"] == {"id": ids["requester_id"], "name": "山田 太郎（架空）"}
    assert item["category"] == {"id": ids["category_id"], "name": "通関書類"}
    assert (item["checklist_done"], item["checklist_total"]) == (1, 3)
    assert item["due_level"] == "overdue"
    assert item["qms"] is True
    assert item["status"] == "作業中"
    # 詳細・受付日・内線番号・チェックリストの中身は、一覧に入れない
    for field in ("description", "received_on", "checklist_items"):
        assert field not in item
    assert "extension" not in item["requester"]


# ---- 手動の並び ----


def test_default_order_is_manual_with_newest_on_top(client, ids):
    create(client, ids, "1番目に作った")
    create(client, ids, "2番目に作った")
    create(client, ids, "3番目に作った")
    assert titles(client) == ["3番目に作った", "2番目に作った", "1番目に作った"]


def test_save_order_changes_the_manual_order(client, ids):
    a, b, c = (create(client, ids, name)["id"] for name in ["A", "B", "C"])
    response = client.put("/api/requests/order", json={"ids": [b, c, a]})
    assert response.status_code == 204
    assert titles(client) == ["B", "C", "A"]


def test_new_request_goes_on_top_after_reordering(client, ids):
    a, b = (create(client, ids, name)["id"] for name in ["A", "B"])
    client.put("/api/requests/order", json={"ids": [a, b]})
    create(client, ids, "新しい")
    assert titles(client) == ["新しい", "A", "B"]


@pytest.mark.parametrize("make_ids", [
    lambda a, b, c: [a, b],  # 足りない
    lambda a, b, c: [a, b, c, 999999],  # 余分
    lambda a, b, c: [a, b, b],  # 重複（足りない分もある）
    lambda a, b, c: [a, a, b, c],  # 重複
    lambda a, b, c: [],
])  # fmt: skip
def test_save_order_with_wrong_ids_returns_409_and_changes_nothing(client, ids, make_ids):
    a, b, c = (create(client, ids, name)["id"] for name in ["A", "B", "C"])
    before = titles(client)
    response = client.put("/api/requests/order", json={"ids": make_ids(a, b, c)})
    assert response.status_code == 409
    assert response.json()["detail"] == "一覧が古くなっています。開き直してください"
    assert titles(client) == before


def test_save_order_excludes_archived_requests(client, ids):
    a, b, c = (create(client, ids, name)["id"] for name in ["A", "B", "C"])
    client.patch(f"/api/requests/{b}", json={"archived": True})
    # アーカイブ中の b を含めると 409。含めなければ 204
    assert client.put("/api/requests/order", json={"ids": [a, b, c]}).status_code == 409
    assert client.put("/api/requests/order", json={"ids": [a, c]}).status_code == 204
    assert titles(client) == ["A", "C"]


def test_save_order_does_not_change_archived_order(client, ids):
    a, b, c = (create(client, ids, name)["id"] for name in ["A", "B", "C"])
    client.patch(f"/api/requests/{b}", json={"archived": True})
    before = titles(client, include_archived=True)
    assert before == ["C", "B", "A"]
    client.put("/api/requests/order", json={"ids": [a, c]})
    # アーカイブ中の B の番号は変わらない。A・C が入れ替わった分だけ、見え方が変わる
    assert [t for t in titles(client, include_archived=True) if t != "B"] == ["A", "C"]


def test_save_order_with_no_active_requests(client):
    assert client.put("/api/requests/order", json={"ids": []}).status_code == 204


def test_save_order_with_invalid_body_returns_422(client):
    assert client.put("/api/requests/order", json={}).status_code == 422
    assert client.put("/api/requests/order", json={"ids": ["あ"]}).status_code == 422


# ---- アーカイブ ----


def test_archived_requests_are_hidden_unless_asked(client, ids):
    kept = create(client, ids, "残る")
    archived = create(client, ids, "アーカイブ")
    client.patch(f"/api/requests/{archived['id']}", json={"archived": True})
    assert titles(client) == ["残る"]
    assert titles(client, include_archived=False) == ["残る"]
    assert sorted(titles(client, include_archived=True)) == ["アーカイブ", "残る"]
    flags = {r["title"]: r["archived"] for r in listing(client, include_archived=True)}
    assert flags == {"残る": False, "アーカイブ": True}
    assert kept["archived"] is False


# ---- 検索 ----


def test_search_by_title_description_requester_and_confirm_to(client, ids):
    other = client.post("/api/requesters", json={"name": "佐藤 花子（架空）"}).json()["id"]
    create(client, ids, "取扱説明書の改訂")
    create(client, ids, "動画の編集", description="冒頭にロゴを入れる")
    create(client, {**ids, "requester_id": other}, "HP の更新")
    create(client, ids, "チラシ", confirm_to="（架空）品質保証課")
    assert titles(client, q="説明書") == ["取扱説明書の改訂"]  # タイトル
    assert titles(client, q="ロゴ") == ["動画の編集"]  # 詳細
    assert titles(client, q="佐藤") == ["HP の更新"]  # 依頼者の名前
    assert titles(client, q="品質保証") == ["チラシ"]  # 確認先
    assert titles(client, q="見つからない言葉") == []


def test_search_is_case_insensitive_and_ignores_surrounding_spaces(client, ids):
    create(client, ids, "Website の更新")
    assert titles(client, q="  website ") == ["Website の更新"]


def test_empty_search_returns_everything(client, ids):
    create(client, ids, "A")
    create(client, ids, "B")
    assert sorted(titles(client, q="")) == ["A", "B"]
    assert sorted(titles(client, q="   ")) == ["A", "B"]


def test_search_treats_percent_and_underscore_as_plain_characters(client, ids):
    create(client, ids, "進捗は100%達成")
    create(client, ids, "進捗は100円")
    create(client, ids, "file_name の修正")
    create(client, ids, "fileXname の修正")
    assert titles(client, q="100%") == ["進捗は100%達成"]
    assert titles(client, q="%") == ["進捗は100%達成"]
    assert titles(client, q="file_name") == ["file_name の修正"]
    assert titles(client, q="_") == ["file_name の修正"]


def test_search_does_not_include_archived_unless_asked(client, ids):
    archived = create(client, ids, "探したい依頼")
    client.patch(f"/api/requests/{archived['id']}", json={"archived": True})
    assert titles(client, q="探したい") == []
    assert titles(client, q="探したい", include_archived=True) == ["探したい依頼"]


# ---- 絞り込み ----


def test_filter_by_qms(client, ids):
    create(client, ids, "QMS あり", qms=True)
    create(client, ids, "QMS なし", qms=False)
    assert titles(client, qms="true") == ["QMS あり"]
    both = {"QMS あり", "QMS なし"}
    assert set(titles(client, qms="false")) == both  # false は絞らない
    assert set(titles(client)) == both


def test_filter_by_category(client, ids):
    other = client.post("/api/categories", json={"name": "別のカテゴリー（テスト）"}).json()["id"]
    create(client, ids, "通関")
    create(client, {**ids, "category_id": other}, "動画の依頼")
    assert titles(client, category_id=other) == ["動画の依頼"]
    assert titles(client, category_id=ids["category_id"]) == ["通関"]
    assert titles(client, category_id=999999) == []


def test_filter_by_status(client, ids):
    create(client, ids, "未着手の依頼", status="未着手")
    create(client, ids, "作業中の依頼", status="作業中")
    assert titles(client, status="作業中") == ["作業中の依頼"]


def test_filters_can_be_combined(client, ids):
    create(client, ids, "A 通関 QMS 作業中", qms=True, status="作業中")
    create(client, ids, "B 通関 QMS 未着手", qms=True, status="未着手")
    create(client, ids, "C 通関 作業中", qms=False, status="作業中")
    assert titles(client, qms="true", status="作業中", q="通関") == ["A 通関 QMS 作業中"]


# ---- 並び替え ----


def test_sort_by_priority(client, ids):
    for title, priority in [("低", "低"), ("急ぎ", "急ぎ"), ("中", "中"), ("高", "高")]:
        create(client, ids, title, priority=priority)
    assert titles(client, sort="priority") == ["急ぎ", "高", "中", "低"]


def test_sort_by_due_date_earliest_first(client, ids):
    create(client, ids, "12月", due_on="2026-12-15")
    create(client, ids, "11月", due_on="2026-11-30")
    create(client, ids, "来年", due_on="2027-01-10")
    assert titles(client, sort="due_on") == ["11月", "12月", "来年"]


def test_sort_by_status_follows_the_fixed_order(client, ids):
    for status in ["ペンディング", "完了", "確認待ち", "作業中", "未着手"]:
        create(client, ids, status, status=status)
    assert titles(client, sort="status") == ["未着手", "作業中", "確認待ち", "完了", "ペンディング"]


def test_same_values_keep_the_manual_order(client, ids):
    a, b, c, d = (create(client, ids, name, priority="高")["id"] for name in "ABCD")
    create(client, ids, "最優先", priority="急ぎ")
    client.put("/api/requests/order", json={"ids": [b, d, a, c, *_others(client, [a, b, c, d])]})
    assert titles(client, sort="priority") == ["最優先", "B", "D", "A", "C"]


def _others(client, known):
    return [r["id"] for r in listing(client) if r["id"] not in known][::-1]


def test_sort_does_not_change_the_manual_order(client, ids):
    create(client, ids, "A", priority="低")
    create(client, ids, "B", priority="急ぎ")
    manual = titles(client)
    assert titles(client, sort="priority") == ["B", "A"]
    assert titles(client) == manual  # 見せ方だけ。手動の並びは変わらない


# ---- 入力の確認 ----


@pytest.mark.parametrize("params", [{"status": "かんりょう"}, {"sort": "title"}, {"qms": "たぶん"}])
def test_invalid_conditions_return_422(client, params):
    assert client.get("/api/requests", params=params).status_code == 422


def test_list_does_not_conflict_with_other_routes(client, ids):
    created = create(client, ids)
    assert client.get(f"/api/requests/{created['id']}").status_code == 200
    assert client.get("/api/requests").status_code == 200
