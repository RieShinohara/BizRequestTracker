"""営業日の計算と、期限の色（due_level）。

営業日 ＝ 土日・日本の祝日・会社の休み（settings.COMPANY_HOLIDAYS）を除いた日。
"""

from datetime import date, datetime, timedelta, timezone
from typing import Literal

import jpholiday

from app.settings import COMPANY_HOLIDAYS, DUE_SOON_BUSINESS_DAYS

# 日本時間。サーバー（AWS）は世界標準時（UTC）で動くことが多く、日付がずれるため、日本時間で決める
JST = timezone(timedelta(hours=9))

DueLevel = Literal["overdue", "soon"]


def today() -> date:
    """今日の日付（日本時間）。テストでは、これを差し替えて、日付を固定する。"""
    return datetime.now(JST).date()


def is_company_holiday(day: date) -> bool:
    for start_month, start_day, end_month, end_day in COMPANY_HOLIDAYS:
        start, end = (start_month, start_day), (end_month, end_day)
        current = (day.month, day.day)
        if start <= end:
            if start <= current <= end:
                return True
        elif current >= start or current <= end:  # 年をまたぐ（12/29〜1/3 など）
            return True
    return False


def is_business_day(day: date) -> bool:
    return day.weekday() < 5 and not jpholiday.is_holiday(day) and not is_company_holiday(day)


def business_days_after(start: date, end: date, limit: int) -> int:
    """start の翌日から end まで（end を含む）の営業日の数。limit を超えたら、数えるのをやめる。

    「3営業日以内か」だけ分かればよいので、期限が遠い依頼でも、長い日数を数えずに済む。
    """
    count = 0
    day = start + timedelta(days=1)
    while day <= end and count <= limit:
        if is_business_day(day):
            count += 1
        day += timedelta(days=1)
    return count


def due_level(
    due_on: date, status: str, archived: bool, now: date | None = None
) -> DueLevel | None:
    """期限の色。overdue（期限切れ・赤）、soon（3営業日以内・オレンジ）、None（色なし）。

    完了・ペンディング・アーカイブ中は、色分けしない。
    """
    if archived or status in ("完了", "ペンディング"):
        return None
    now = now or today()
    if due_on < now:
        return "overdue"
    if business_days_after(now, due_on, DUE_SOON_BUSINESS_DAYS) <= DUE_SOON_BUSINESS_DAYS:
        return "soon"
    return None
