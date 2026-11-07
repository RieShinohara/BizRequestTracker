def make_category(client, name="通関書類"):
    return client.post("/api/categories", json={"name": name}).json()["id"]


def url(category_id):
    return f"/api/categories/{category_id}/template-items"


def put(client, category_id, names):
    return client.put(url(category_id), json={"items": [{"name": n} for n in names]})


def names_of(client, category_id):
    return [item["name"] for item in client.get(url(category_id)).json()]


def test_new_category_has_no_template(client):
    response = client.get(url(make_category(client)))
    assert response.status_code == 200
    assert response.json() == []


def test_put_saves_in_the_order_sent(client):
    category_id = make_category(client)
    response = put(client, category_id, ["原稿の確認", "翻訳", "校正"])
    assert response.status_code == 200
    assert response.json() == [{"name": "原稿の確認"}, {"name": "翻訳"}, {"name": "校正"}]
    assert names_of(client, category_id) == ["原稿の確認", "翻訳", "校正"]


def test_put_replaces_the_whole_list(client):
    category_id = make_category(client)
    put(client, category_id, ["A", "B", "C"])
    put(client, category_id, ["C", "D"])  # A・B を削除、D を追加、順番も変更
    assert names_of(client, category_id) == ["C", "D"]


def test_put_empty_list_clears_the_template(client):
    category_id = make_category(client)
    put(client, category_id, ["A", "B"])
    assert put(client, category_id, []).status_code == 200
    assert names_of(client, category_id) == []


def test_put_does_not_touch_other_categories(client):
    first = make_category(client, "最初")
    second = make_category(client, "二番目")
    put(client, first, ["first-1"])
    put(client, second, ["second-1", "second-2"])
    put(client, first, [])
    assert names_of(client, second) == ["second-1", "second-2"]


def test_item_name_is_trimmed(client):
    category_id = make_category(client)
    put(client, category_id, ["  前後に空白  "])
    assert names_of(client, category_id) == ["前後に空白"]


def test_empty_item_name_returns_422_and_keeps_the_old_template(client):
    category_id = make_category(client)
    put(client, category_id, ["残る項目"])
    assert put(client, category_id, ["新しい項目", "  "]).status_code == 422
    assert names_of(client, category_id) == ["残る項目"]


def test_too_long_item_name_returns_422(client):
    category_id = make_category(client)
    assert put(client, category_id, ["あ" * 201]).status_code == 422


def test_missing_items_returns_422(client):
    category_id = make_category(client)
    assert client.put(url(category_id), json={}).status_code == 422


def test_unknown_category_returns_404(client):
    assert client.get(url(999999)).status_code == 404
    assert put(client, 999999, ["A"]).status_code == 404
