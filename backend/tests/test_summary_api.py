import pytest

STATUSES = ["未着手", "作業中", "確認待ち", "完了", "ペンディング"]


@pytest.fixture
def ids(client):
    requester = client.post("/api/requesters", json={"name": "山田 太郎（架空）"}).json()
    category = client.post("/api/categories", json={"name": "通関書類"}).json()
    return {"requester_id": requester["id"], "category_id": category["id"]}


def create(client, ids, **overrides):
    body = {"title": "依頼", "due_on": "2026-12-01", **ids, **overrides}
    response = client.post("/api/requests", json=body)
    assert response.status_code == 201
    return response.json()


def summary(client):
    response = client.get("/api/summary")
    assert response.status_code == 200
    return response.json()


def test_empty_returns_all_statuses_with_zero(client):
    body = summary(client)
    assert list(body["status_counts"]) == STATUSES
    assert all(count == 0 for count in body["status_counts"].values())
    assert body["urgent_count"] == 0


def test_counts_by_status(client, ids):
    for status in ["未着手", "未着手", "作業中", "完了", "ペンディング"]:
        create(client, ids, status=status)
    assert summary(client)["status_counts"] == {
        "未着手": 2,
        "作業中": 1,
        "確認待ち": 0,
        "完了": 1,
        "ペンディング": 1,
    }


def test_archived_requests_are_not_counted(client, ids):
    kept = create(client, ids, status="作業中")
    archived = create(client, ids, status="作業中", priority="急ぎ")
    client.patch(f"/api/requests/{archived['id']}", json={"archived": True})
    body = summary(client)
    assert body["status_counts"]["作業中"] == 1
    assert body["urgent_count"] == 0
    # アーカイブから戻すと、また数える
    client.patch(f"/api/requests/{archived['id']}", json={"archived": False})
    assert summary(client)["status_counts"]["作業中"] == 2
    assert kept["id"] != archived["id"]


def test_urgent_count_excludes_done_and_other_priorities(client, ids):
    create(client, ids, priority="急ぎ", status="未着手")
    create(client, ids, priority="急ぎ", status="ペンディング")
    create(client, ids, priority="急ぎ", status="完了")  # 完了は数えない
    create(client, ids, priority="高", status="未着手")
    assert summary(client)["urgent_count"] == 2
