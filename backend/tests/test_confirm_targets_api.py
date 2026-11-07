import pytest

from app.settings import CONFIRM_TARGET_DEFAULTS


@pytest.fixture
def ids(client):
    requester = client.post("/api/requesters", json={"name": "山田 太郎（架空）"}).json()
    category = client.post("/api/categories", json={"name": "通関書類"}).json()
    return {"requester_id": requester["id"], "category_id": category["id"]}


def create(client, ids, **overrides):
    body = {"title": "依頼", "due_on": "2026-12-01", **ids, **overrides}
    return client.post("/api/requests", json=body).json()


def targets(client):
    response = client.get("/api/confirm-targets")
    assert response.status_code == 200
    return response.json()


def test_without_requests_returns_only_the_defaults(client):
    assert (
        targets(client)
        == CONFIRM_TARGET_DEFAULTS
        == ["依頼者", "薬事部", "開発部", "営業部", "工場"]
    )


def test_used_confirm_to_follow_the_defaults(client, ids):
    create(client, ids, confirm_to="（架空）品質保証課")
    assert targets(client) == [*CONFIRM_TARGET_DEFAULTS, "（架空）品質保証課"]


def test_same_text_is_not_repeated(client, ids):
    create(client, ids, confirm_to="（架空）品質保証課")
    create(client, ids, confirm_to="（架空）品質保証課")
    create(client, ids, confirm_to="薬事部")  # 最初の候補と同じ文字も、重ねない
    assert targets(client) == [*CONFIRM_TARGET_DEFAULTS, "（架空）品質保証課"]


def test_archived_requests_are_included(client, ids):
    archived = create(client, ids, confirm_to="（架空）法務課")
    client.patch(f"/api/requests/{archived['id']}", json={"archived": True})
    assert "（架空）法務課" in targets(client)


def test_requests_without_confirm_to_add_nothing(client, ids):
    create(client, ids)
    create(client, ids, confirm_to="   ")  # 空白だけは「なし」として保存される
    assert targets(client) == CONFIRM_TARGET_DEFAULTS


def test_candidates_stay_after_status_leaves_waiting(client, ids):
    created = create(client, ids, status="確認待ち", confirm_to="（架空）品質保証課")
    client.patch(f"/api/requests/{created['id']}", json={"status": "作業中"})
    assert "（架空）品質保証課" in targets(client)  # 確認先は消えないので、候補にも残る
