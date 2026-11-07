from datetime import date

import pytest
from sqlalchemy import func, select

from app.models import ChecklistItem, Request


@pytest.fixture
def ids(client):
    """依頼を作るのに必要な、依頼者とカテゴリー。"""
    requester = client.post(
        "/api/requesters", json={"name": "山田 太郎（架空）", "extension": "0123"}
    ).json()
    category = client.post("/api/categories", json={"name": "通関書類"}).json()
    return {"requester_id": requester["id"], "category_id": category["id"]}


def create(client, ids, **overrides):
    body = {"title": "書類の作成", "due_on": "2026-12-01", **ids, **overrides}
    return client.post("/api/requests", json=body)


# ---- 追加（POST） ----


def test_create_with_defaults(client, ids):
    response = create(client, ids)
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "書類の作成"
    assert body["status"] == "未着手"
    assert body["priority"] == "中"
    assert body["qms"] is False
    assert body["archived"] is False
    assert body["confirm_to"] is None
    assert body["received_on"] == date.today().isoformat()
    assert body["requester"] == {
        "id": ids["requester_id"],
        "name": "山田 太郎（架空）",
        "extension": "0123",
    }
    assert body["category"] == {"id": ids["category_id"], "name": "通関書類"}
    assert body["checklist_items"] == []
    assert body["checklist_done"] == 0
    assert body["checklist_total"] == 0


def test_create_with_all_fields_and_checklist(client, ids):
    response = create(
        client,
        ids,
        description="詳細",
        received_on="2026-11-01",
        status="作業中",
        priority="急ぎ",
        confirm_to="薬事部",
        qms=True,
        checklist_items=[{"name": "確認", "done": True}, {"name": "提出"}],
    )
    assert response.status_code == 201
    body = response.json()
    assert body["description"] == "詳細"
    assert body["received_on"] == "2026-11-01"
    assert body["status"] == "作業中"
    assert body["priority"] == "急ぎ"
    assert body["confirm_to"] == "薬事部"
    assert body["qms"] is True
    assert body["checklist_items"] == [
        {"name": "確認", "done": True},
        {"name": "提出", "done": False},
    ]
    assert (body["checklist_done"], body["checklist_total"]) == (1, 2)


def test_new_request_goes_to_the_top_of_the_manual_order(client, ids, db):
    first = create(client, ids).json()["id"]
    second = create(client, ids).json()["id"]
    third = create(client, ids).json()["id"]
    order = {r.id: r.sort_order for r in db.scalars(select(Request))}
    assert order[third] < order[second] < order[first]


@pytest.mark.parametrize(
    "overrides",
    [
        {"title": "   "},
        {"title": None},
        {"due_on": None},
        {"due_on": "来週"},
        {"status": "かんりょう"},
        {"priority": "最高"},
        {"checklist_items": [{"name": ""}]},
    ],
)
def test_create_with_invalid_input_returns_422(client, ids, overrides):
    assert create(client, ids, **overrides).status_code == 422


def test_create_with_unknown_requester_or_category_returns_422(client, ids):
    assert create(client, {**ids, "requester_id": 999999}).status_code == 422
    assert create(client, {**ids, "category_id": 999999}).status_code == 422


def test_create_without_required_fields_returns_422(client):
    assert client.post("/api/requests", json={"title": "だけ"}).status_code == 422


# ---- 1件取得（GET） ----


def test_get_returns_the_same_as_create(client, ids):
    created = create(client, ids, checklist_items=[{"name": "A"}]).json()
    response = client.get(f"/api/requests/{created['id']}")
    assert response.status_code == 200
    assert response.json() == created


def test_get_unknown_returns_404(client):
    response = client.get("/api/requests/999999")
    assert response.status_code == 404
    assert "detail" in response.json()


# ---- 更新（PATCH） ----


def test_patch_changes_only_the_sent_fields(client, ids):
    created = create(client, ids, priority="高").json()
    response = client.patch(f"/api/requests/{created['id']}", json={"status": "作業中"})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "作業中"
    assert body["priority"] == "高"
    assert body["title"] == created["title"]


def test_patch_status_to_waiting_with_confirm_to(client, ids):
    created = create(client, ids).json()
    response = client.patch(
        f"/api/requests/{created['id']}", json={"status": "確認待ち", "confirm_to": "薬事部"}
    )
    assert response.json()["confirm_to"] == "薬事部"


def test_confirm_to_is_kept_when_status_leaves_waiting(client, ids):
    created = create(client, ids, status="確認待ち", confirm_to="薬事部").json()
    response = client.patch(f"/api/requests/{created['id']}", json={"status": "作業中"})
    assert response.json()["status"] == "作業中"
    assert response.json()["confirm_to"] == "薬事部"  # 消さない


def test_patch_can_clear_description_and_confirm_to(client, ids):
    created = create(client, ids, description="消す", confirm_to="薬事部").json()
    response = client.patch(
        f"/api/requests/{created['id']}", json={"description": None, "confirm_to": None}
    )
    assert response.json()["description"] is None
    assert response.json()["confirm_to"] is None


def test_archive_and_restore(client, ids):
    created = create(client, ids).json()
    url = f"/api/requests/{created['id']}"
    assert client.patch(url, json={"archived": True}).json()["archived"] is True
    assert client.patch(url, json={"archived": False}).json()["archived"] is False


def test_patch_replaces_the_whole_checklist(client, ids, db):
    created = create(client, ids, checklist_items=[{"name": "A"}, {"name": "B"}]).json()
    url = f"/api/requests/{created['id']}"
    response = client.patch(
        url, json={"checklist_items": [{"name": "B", "done": True}, {"name": "C"}]}
    )
    assert response.json()["checklist_items"] == [
        {"name": "B", "done": True},
        {"name": "C", "done": False},
    ]
    assert (response.json()["checklist_done"], response.json()["checklist_total"]) == (1, 2)
    assert db.scalar(select(func.count()).select_from(ChecklistItem)) == 2  # 古い A・B は残らない


def test_patch_without_checklist_keeps_it(client, ids):
    created = create(client, ids, checklist_items=[{"name": "A"}]).json()
    response = client.patch(f"/api/requests/{created['id']}", json={"title": "題名だけ変える"})
    assert response.json()["checklist_items"] == [{"name": "A", "done": False}]


def test_patch_empty_checklist_clears_it(client, ids):
    created = create(client, ids, checklist_items=[{"name": "A"}]).json()
    response = client.patch(f"/api/requests/{created['id']}", json={"checklist_items": []})
    assert response.json()["checklist_items"] == []


def test_patch_can_change_requester_and_category(client, ids):
    created = create(client, ids).json()
    other_requester = client.post("/api/requesters", json={"name": "別の人"}).json()["id"]
    other_category = client.post("/api/categories", json={"name": "別のカテゴリー"}).json()["id"]
    response = client.patch(
        f"/api/requests/{created['id']}",
        json={"requester_id": other_requester, "category_id": other_category},
    )
    assert response.json()["requester"]["name"] == "別の人"
    assert response.json()["category"]["name"] == "別のカテゴリー"


@pytest.mark.parametrize(
    "body",
    [
        {"status": "かんりょう"},
        {"priority": "最高"},
        {"title": ""},
        {"title": None},
        {"due_on": None},
        {"archived": None},
        {"checklist_items": None},
        {"requester_id": 999999},
        {"category_id": 999999},
    ],
)
def test_patch_with_invalid_input_returns_422_and_changes_nothing(client, ids, body):
    created = create(client, ids).json()
    url = f"/api/requests/{created['id']}"
    assert client.patch(url, json=body).status_code == 422
    assert client.get(url).json() == created


def test_patch_unknown_returns_404(client):
    assert client.patch("/api/requests/999999", json={"title": "いない"}).status_code == 404


# ---- 削除（DELETE） ----


def test_delete_archived_request_returns_204_and_removes_checklist(client, ids, db):
    created = create(client, ids, checklist_items=[{"name": "A"}]).json()
    url = f"/api/requests/{created['id']}"
    client.patch(url, json={"archived": True})
    assert client.delete(url).status_code == 204
    assert client.get(url).status_code == 404
    assert db.scalar(select(func.count()).select_from(ChecklistItem)) == 0


def test_delete_not_archived_returns_409(client, ids):
    created = create(client, ids).json()
    url = f"/api/requests/{created['id']}"
    response = client.delete(url)
    assert response.status_code == 409
    assert response.json()["detail"] == "アーカイブ中の依頼だけ削除できます"
    assert client.get(url).status_code == 200  # 消えていない


def test_delete_unknown_returns_404(client):
    assert client.delete("/api/requests/999999").status_code == 404


# ---- 他の窓口との関係 ----


def test_category_in_use_cannot_be_deleted(client, ids):
    create(client, ids)
    assert client.delete(f"/api/categories/{ids['category_id']}").status_code == 409
    counts = {c["id"]: c["request_count"] for c in client.get("/api/categories").json()}
    assert counts[ids["category_id"]] == 1
