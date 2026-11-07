"""API で送る・受け取る JSON の形と、入力の確認。"""

from typing import Annotated

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
