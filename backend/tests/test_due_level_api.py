from datetime import date

import pytest


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    """「今日」を、2026-11-20（金）に固定する。"""
    monkeypatch.setattr("app.business_days.today", lambda: date(2026, 11, 20))


@pytest.fixture
def ids(client):
    requester = client.post("/api/requesters", json={"name": "山田 太郎（架空）"}).json()
    category = client.post("/api/categories", json={"name": "通関書類"}).json()
    return {"requester_id": requester["id"], "category_id": category["id"]}


def create(client, ids, due_on, **overrides):
    body = {"title": "依頼", "due_on": due_on, **ids, **overrides}
    response = client.post("/api/requests", json=body)
    assert response.status_code == 201
    return response.json()


@pytest.mark.parametrize(
    ("due_on", "expected"),
    [
        ("2026-11-19", "overdue"),
        ("2026-11-20", "soon"),
        ("2026-11-26", "soon"),
        ("2026-11-27", None),
    ],
)
def test_create_returns_due_level(client, ids, due_on, expected):
    assert create(client, ids, due_on)["due_level"] == expected


def test_get_returns_due_level(client, ids):
    created = create(client, ids, "2026-11-19")
    assert client.get(f"/api/requests/{created['id']}").json()["due_level"] == "overdue"


def test_due_level_is_none_when_done_pending_or_archived(client, ids):
    created = create(client, ids, "2026-11-19")  # 期限切れ
    url = f"/api/requests/{created['id']}"
    assert created["due_level"] == "overdue"
    assert client.patch(url, json={"status": "完了"}).json()["due_level"] is None
    assert client.patch(url, json={"status": "ペンディング"}).json()["due_level"] is None
    assert client.patch(url, json={"status": "作業中"}).json()["due_level"] == "overdue"
    assert client.patch(url, json={"archived": True}).json()["due_level"] is None


def test_changing_due_date_changes_due_level(client, ids):
    created = create(client, ids, "2026-11-19")
    response = client.patch(f"/api/requests/{created['id']}", json={"due_on": "2026-12-31"})
    assert response.json()["due_level"] is None
