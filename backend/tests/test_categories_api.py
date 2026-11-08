from datetime import date

from sqlalchemy import func, select

from app.models import Request, Requester, TemplateItem


def create(client, name="通関書類"):
    return client.post("/api/categories", json={"name": name})


def find(client, category_id):
    return next(c for c in client.get("/api/categories").json() if c["id"] == category_id)


def test_create_returns_201_with_zero_requests(client):
    response = create(client)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "通関書類"
    assert body["request_count"] == 0


def test_duplicate_name_returns_409(client):
    create(client, "同じ名前")
    assert create(client, "同じ名前").status_code == 409


def test_empty_name_returns_422(client):
    assert create(client, "  ").status_code == 422


def test_list_includes_request_count(client):
    category_id = create(client, "件数を見る").json()["id"]
    assert find(client, category_id)["request_count"] == 0


def test_patch_renames(client):
    category_id = create(client, "変更前").json()["id"]
    response = client.patch(f"/api/categories/{category_id}", json={"name": "変更後"})
    assert response.status_code == 200
    assert response.json()["name"] == "変更後"


def test_patch_to_existing_name_returns_409(client):
    create(client, "先にある")
    category_id = create(client, "あとから").json()["id"]
    response = client.patch(f"/api/categories/{category_id}", json={"name": "先にある"})
    assert response.status_code == 409


def test_patch_unknown_id_returns_404(client):
    assert client.patch("/api/categories/999999", json={"name": "いない"}).status_code == 404


def test_delete_unused_category_returns_204(client):
    category_id = create(client, "消してよい").json()["id"]
    assert client.delete(f"/api/categories/{category_id}").status_code == 204
    assert all(c["id"] != category_id for c in client.get("/api/categories").json())


def test_delete_unknown_id_returns_404(client):
    assert client.delete("/api/categories/999999").status_code == 404


def test_delete_also_removes_template_items(client, db):
    category_id = create(client, "テンプレートつき").json()["id"]
    # テンプレートの API は別の Issue で作るので、ここでは Session で直接足す
    db.add(TemplateItem(category_id=category_id, name="項目", sort_order=1))
    db.commit()
    assert client.delete(f"/api/categories/{category_id}").status_code == 204
    remaining = select(func.count()).select_from(TemplateItem)
    assert db.scalar(remaining.where(TemplateItem.category_id == category_id)) == 0


def test_category_in_use_cannot_be_deleted_and_is_counted(client, db):
    category_id = create(client, "使用中").json()["id"]
    requester = Requester(name="使用中テスト（架空）")
    db.add(requester)
    db.flush()
    db.add(
        Request(
            title="依頼",
            requester_id=requester.id,
            category_id=category_id,
            due_on=date(2026, 12, 1),
            sort_order=1,
        )
    )
    db.commit()

    assert find(client, category_id)["request_count"] == 1
    response = client.delete(f"/api/categories/{category_id}")
    assert response.status_code == 409
    assert "detail" in response.json()
