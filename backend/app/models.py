"""表の定義。設計は docs/data-model.md を参照。

ステータスと優先度は、DB には文字で持つ。許される値の確認は、API の入口で行う。
"""

from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Requester(Base):
    """依頼者。削除する機能は作らない（依頼が使っているため）。"""

    __tablename__ = "requester"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    extension: Mapped[str | None] = mapped_column(String(20))  # 先頭の 0 を守るため文字


class Category(Base):
    """業務カテゴリー。使っている依頼があるあいだは削除できない（RESTRICT）。"""

    __tablename__ = "category"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)

    template_items: Mapped[list["TemplateItem"]] = relationship(
        back_populates="category",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="TemplateItem.sort_order",
    )


class Request(Base):
    """依頼。"""

    __tablename__ = "request"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    requester_id: Mapped[int] = mapped_column(ForeignKey("requester.id", ondelete="RESTRICT"))
    category_id: Mapped[int] = mapped_column(ForeignKey("category.id", ondelete="RESTRICT"))
    received_on: Mapped[date] = mapped_column(Date, default=date.today)  # 初期値は今日
    due_on: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="未着手", server_default="未着手")
    priority: Mapped[str] = mapped_column(String(20), default="中", server_default="中")
    confirm_to: Mapped[str | None] = mapped_column(String(100))  # 確認先（文字。表にしない）
    qms: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    archived: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    sort_order: Mapped[int] = mapped_column(Integer)  # 手動の並び順

    requester: Mapped[Requester] = relationship()
    category: Mapped[Category] = relationship()
    checklist_items: Mapped[list["ChecklistItem"]] = relationship(
        back_populates="request",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ChecklistItem.sort_order",
    )


class TemplateItem(Base):
    """テンプレート項目。カテゴリーを削除すると、一緒に消える。"""

    __tablename__ = "template_item"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("category.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200))
    sort_order: Mapped[int] = mapped_column(Integer)

    category: Mapped[Category] = relationship(back_populates="template_items")


class ChecklistItem(Base):
    """チェック項目。依頼を削除すると、一緒に消える。"""

    __tablename__ = "checklist_item"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("request.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200))
    done: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    sort_order: Mapped[int] = mapped_column(Integer)

    request: Mapped[Request] = relationship(back_populates="checklist_items")
