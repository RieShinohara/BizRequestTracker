from datetime import date

import pytest
from sqlalchemy import func, inspect, select
from sqlalchemy.exc import IntegrityError

from app.models import Category, ChecklistItem, Request, Requester, TemplateItem


def make_request(session, **overrides) -> Request:
    requester = Requester(name="テスト部 山田（架空）")
    category = Category(name="通関書類")
    session.add_all([requester, category])
    session.flush()
    values = dict(
        title="書類の作成",
        requester_id=requester.id,
        category_id=category.id,
        due_on=date(2026, 12, 1),
        sort_order=1,
    )
    values.update(overrides)
    request = Request(**values)
    session.add(request)
    session.flush()
    return request


def test_five_tables_exist(engine):
    tables = set(inspect(engine).get_table_names())
    assert {"requester", "category", "request", "template_item", "checklist_item"} <= tables


def test_request_defaults(session):
    request = make_request(session)
    session.refresh(request)
    assert request.status == "未着手"
    assert request.priority == "中"
    assert request.qms is False
    assert request.archived is False
    assert request.received_on == date.today()
    assert request.confirm_to is None


def test_requester_name_must_be_unique(session):
    session.add_all([Requester(name="同じ名前"), Requester(name="同じ名前")])
    with pytest.raises(IntegrityError):
        session.flush()


def test_category_name_must_be_unique(session):
    session.add_all([Category(name="同じ名前"), Category(name="同じ名前")])
    with pytest.raises(IntegrityError):
        session.flush()


def test_request_requires_title_and_due_date(session):
    with pytest.raises(IntegrityError):
        make_request(session, title=None)


def test_extension_keeps_leading_zero(session):
    requester = Requester(name="内線テスト", extension="0123")
    session.add(requester)
    session.flush()
    session.refresh(requester)
    assert requester.extension == "0123"


def test_deleting_request_deletes_its_checklist(session):
    request = make_request(session)
    session.add(ChecklistItem(request_id=request.id, name="確認", sort_order=1))
    session.flush()
    session.delete(request)
    session.flush()
    assert session.scalar(select(func.count()).select_from(ChecklistItem)) == 0


def test_deleting_category_deletes_its_template_items(session):
    category = Category(name="削除してよいカテゴリー")
    session.add(category)
    session.flush()
    session.add(TemplateItem(category_id=category.id, name="項目", sort_order=1))
    session.flush()
    session.delete(category)
    session.flush()
    remaining = select(func.count()).select_from(TemplateItem)
    assert session.scalar(remaining.where(TemplateItem.category_id == category.id)) == 0


def test_category_in_use_cannot_be_deleted(session):
    request = make_request(session)
    session.delete(request.category)
    with pytest.raises(IntegrityError):
        session.flush()


def test_requester_in_use_cannot_be_deleted(session):
    request = make_request(session)
    session.delete(request.requester)
    with pytest.raises(IntegrityError):
        session.flush()
