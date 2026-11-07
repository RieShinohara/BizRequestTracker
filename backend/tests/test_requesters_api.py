def create(client, name="山田 太郎（架空）", **extra):
    return client.post("/api/requesters", json={"name": name, **extra})


def test_create_returns_201_and_the_new_requester(client):
    response = create(client, extension="0123")
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "山田 太郎（架空）"
    assert body["extension"] == "0123"  # 先頭の 0 が残る
    assert isinstance(body["id"], int)


def test_extension_is_optional(client):
    response = create(client)
    assert response.status_code == 201
    assert response.json()["extension"] is None


def test_duplicate_name_returns_409(client):
    create(client, "同じ名前")
    response = create(client, "同じ名前")
    assert response.status_code == 409
    assert "detail" in response.json()


def test_empty_name_returns_422(client):
    assert create(client, "   ").status_code == 422
    assert client.post("/api/requesters", json={}).status_code == 422


def test_name_is_trimmed(client):
    assert create(client, "  前後に空白  ").json()["name"] == "前後に空白"


def test_list_is_sorted_by_name(client):
    for name in ["う", "あ", "い"]:
        create(client, name)
    names = [r["name"] for r in client.get("/api/requesters").json()]
    assert names == sorted(names)
    assert {"あ", "い", "う"} <= set(names)


def test_patch_changes_only_the_sent_fields(client):
    created = create(client, "変更前", extension="1111").json()
    response = client.patch(f"/api/requesters/{created['id']}", json={"extension": "2222"})
    assert response.status_code == 200
    assert response.json()["name"] == "変更前"
    assert response.json()["extension"] == "2222"


def test_patch_can_clear_extension(client):
    created = create(client, "内線を消す", extension="1111").json()
    response = client.patch(f"/api/requesters/{created['id']}", json={"extension": None})
    assert response.json()["extension"] is None


def test_patch_name_to_existing_returns_409(client):
    create(client, "先にいる人")
    other = create(client, "あとから来た人").json()
    response = client.patch(f"/api/requesters/{other['id']}", json={"name": "先にいる人"})
    assert response.status_code == 409


def test_patch_name_null_returns_422(client):
    created = create(client, "名前は消せない").json()
    response = client.patch(f"/api/requesters/{created['id']}", json={"name": None})
    assert response.status_code == 422


def test_patch_unknown_id_returns_404(client):
    response = client.patch("/api/requesters/999999", json={"name": "いない"})
    assert response.status_code == 404
    assert "detail" in response.json()


def test_no_delete_endpoint(client):
    created = create(client, "削除はできない").json()
    assert client.delete(f"/api/requesters/{created['id']}").status_code == 405
