"""API で送る・受け取る JSON の形と、入力の確認。"""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator, model_validator

# 前後の空白は取り除き、空の名前は受け付けない
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Extension = Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)]


def _empty_to_none(value: str | None) -> str | None:
    return value or None


class RequesterCreate(BaseModel):
    name: Name
    extension: Extension | None = None

    _extension = field_validator("extension")(_empty_to_none)


class RequesterUpdate(BaseModel):
    """送った項目だけ変える（PATCH）。"""

    name: Name | None = None
    extension: Extension | None = None

    _extension = field_validator("extension")(_empty_to_none)

    @model_validator(mode="after")
    def name_cannot_be_null(self):
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name は空にできません")
        return self


class RequesterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    extension: str | None


class CategoryCreate(BaseModel):
    name: Name


class CategoryUpdate(BaseModel):
    name: Name


ItemName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class TemplateItemIO(BaseModel):
    """テンプレート項目。順番は、並び方（先頭から）で表す。"""

    name: ItemName


class TemplateItemsReplace(BaseModel):
    items: list[TemplateItemIO]


class CategoryOut(BaseModel):
    id: int
    name: str
    request_count: int  # そのカテゴリーを使っている依頼の数（削除できるかの目安）


# ---- 依頼 ----

# 許される値。DB には文字で持つので、API の入口で確認する（docs/data-model.md）
Status = Literal["未着手", "作業中", "確認待ち", "完了", "ペンディング"]
Priority = Literal["急ぎ", "高", "中", "低"]

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
ConfirmTo = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]
Description = Annotated[str, StringConstraints(max_length=10000)]


class ChecklistItemIO(BaseModel):
    name: ItemName
    done: bool = False


class RequestCreate(BaseModel):
    title: Title
    requester_id: int
    category_id: int
    due_on: date
    description: Description | None = None
    received_on: date | None = None  # 省略すると、今日
    status: Status = "未着手"
    priority: Priority = "中"
    confirm_to: ConfirmTo | None = None
    qms: bool = False
    checklist_items: list[ChecklistItemIO] = []

    _confirm_to = field_validator("confirm_to")(_empty_to_none)


class RequestUpdate(BaseModel):
    """送った項目だけ変える（PATCH）。archived も送れる。"""

    title: Title | None = None
    requester_id: int | None = None
    category_id: int | None = None
    due_on: date | None = None
    description: Description | None = None
    received_on: date | None = None
    status: Status | None = None
    priority: Priority | None = None
    confirm_to: ConfirmTo | None = None
    qms: bool | None = None
    archived: bool | None = None
    checklist_items: list[ChecklistItemIO] | None = None

    _confirm_to = field_validator("confirm_to")(_empty_to_none)

    # null を送って「消す」ことができるのは、この2つだけ。ほかは必須の項目
    @model_validator(mode="after")
    def required_fields_cannot_be_null(self):
        for field in self.model_fields_set - {"description", "confirm_to"}:
            if getattr(self, field) is None:
                raise ValueError(f"{field} は空にできません")
        return self


class RequesterBrief(BaseModel):
    id: int
    name: str
    extension: str | None


class CategoryBrief(BaseModel):
    id: int
    name: str


class ChecklistItemOut(BaseModel):
    name: str
    done: bool


class RequestOut(BaseModel):
    id: int
    title: str
    description: str | None
    requester: RequesterBrief
    category: CategoryBrief
    received_on: date
    due_on: date
    status: str
    priority: str
    confirm_to: str | None
    qms: bool
    archived: bool
    checklist_done: int
    checklist_total: int
    due_level: Literal["overdue", "soon"] | None  # 期限の色。None は、色なし
    checklist_items: list[ChecklistItemOut]
