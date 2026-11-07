"""営業日の計算と、期限の色。DB は使わない（日付だけの計算）。

2026年の曜日：11/20（金）、12/25（金）、8/10（月）。
"""

from datetime import date

import pytest

from app.business_days import business_days_after, due_level, is_business_day, is_company_holiday


@pytest.mark.parametrize(
    ("day", "expected"),
    [
        (date(2026, 12, 28), False),  # 年末年始の前日
        (date(2026, 12, 29), True),
        (date(2026, 12, 31), True),
        (date(2027, 1, 1), True),
        (date(2027, 1, 3), True),
        (date(2027, 1, 4), False),  # 年始の休みの翌日
        (date(2026, 8, 11), False),  # 山の日（祝日だが、会社の休みではない）
        (date(2026, 8, 12), True),
        (date(2026, 8, 15), True),
        (date(2026, 8, 16), False),
        (date(2026, 6, 1), False),
    ],
)
def test_company_holiday(day, expected):
    assert is_company_holiday(day) is expected


@pytest.mark.parametrize(
    ("day", "expected"),
    [
        (date(2026, 11, 20), True),  # 金
        (date(2026, 11, 21), False),  # 土
        (date(2026, 11, 22), False),  # 日
        (date(2026, 11, 23), False),  # 勤労感謝の日（祝日）
        (date(2026, 9, 22), False),  # 国民の休日（祝日に挟まれた日）
        (date(2026, 8, 11), False),  # 山の日（祝日）
        (date(2026, 8, 13), False),  # 夏休み（会社の休み。平日）
        (date(2026, 12, 30), False),  # 年末年始（会社の休み。平日）
        (date(2027, 1, 4), True),  # 年始の休みが明けた日
    ],
)
def test_is_business_day(day, expected):
    assert is_business_day(day) is expected


def test_business_days_after_skips_weekend_and_holiday():
    # 金 11/20 の翌日から。土・日・月（祝日）を飛ばして、火 24 水 25 木 26
    assert business_days_after(date(2026, 11, 20), date(2026, 11, 24), limit=3) == 1
    assert business_days_after(date(2026, 11, 20), date(2026, 11, 26), limit=3) == 3
    assert business_days_after(date(2026, 11, 20), date(2026, 11, 23), limit=3) == 0


def test_business_days_after_stops_counting_past_the_limit():
    # 遠い期限でも、limit + 1 で打ち切る
    assert business_days_after(date(2026, 11, 20), date(2030, 1, 1), limit=3) == 4


NOW = date(2026, 11, 20)  # 金曜


@pytest.mark.parametrize(
    ("due_on", "expected"),
    [
        (date(2026, 11, 19), "overdue"),  # きのう
        (date(2026, 1, 1), "overdue"),
        (date(2026, 11, 20), "soon"),  # きょう（期限切れではない）
        (date(2026, 11, 21), "soon"),  # 土曜（営業日は0）
        (date(2026, 11, 23), "soon"),  # 月曜・祝日（営業日は0）
        (date(2026, 11, 24), "soon"),  # 1営業日
        (date(2026, 11, 26), "soon"),  # 3営業日（ぎりぎり）
        (date(2026, 11, 27), None),  # 4営業日
        (date(2027, 6, 1), None),
    ],
)
def test_due_level_by_date(due_on, expected):
    assert due_level(due_on, "作業中", False, now=NOW) == expected


@pytest.mark.parametrize("status", ["完了", "ペンディング"])
def test_no_color_for_done_and_pending(status):
    assert due_level(date(2026, 11, 1), status, False, now=NOW) is None  # 期限切れでも色なし
    assert due_level(date(2026, 11, 21), status, False, now=NOW) is None


def test_no_color_for_archived():
    assert due_level(date(2026, 11, 1), "作業中", True, now=NOW) is None


@pytest.mark.parametrize("status", ["未着手", "作業中", "確認待ち"])
def test_color_for_other_statuses(status):
    assert due_level(date(2026, 11, 19), status, False, now=NOW) == "overdue"


def test_year_end_holidays_are_not_counted():
    # 金 12/25 の翌日から数える。12/28（月）が1。年末年始（12/29〜1/3）は飛ばす。
    # 1/4（月）が2、1/5 が3、1/6 が4
    friday = date(2026, 12, 25)
    assert due_level(date(2027, 1, 5), "作業中", False, now=friday) == "soon"
    assert due_level(date(2027, 1, 6), "作業中", False, now=friday) is None


def test_summer_holidays_are_not_counted():
    # 月 8/10 の翌日から数える。8/11（山の日）と、8/12〜15（夏休み）は飛ばす。
    # 8/17（月）が1、8/18 が2、8/19 が3、8/20 が4
    monday = date(2026, 8, 10)
    assert due_level(date(2026, 8, 19), "作業中", False, now=monday) == "soon"
    assert due_level(date(2026, 8, 20), "作業中", False, now=monday) is None
