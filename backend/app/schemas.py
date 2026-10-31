"""Pydantic request and response schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


MushroomCategory = Literal["edible", "poisonous", "unknown"]


class MushroomFields(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=100, examples=["Лисичка обыкновенная"])
    latin: str | None = Field(default=None, min_length=3, max_length=120, examples=["Cantharellus cibarius"])
    family: str = Field(min_length=2, max_length=100, examples=["Лисичковые"])
    season: str = Field(min_length=3, max_length=100, examples=["июнь — ноябрь"])
    category: MushroomCategory
    description: str = Field(min_length=10, max_length=700)
    illustration: str | None = Field(default=None, max_length=500, pattern=r"^/assets/images/[A-Za-z0-9_.-]+$")
    photo: str | None = Field(
        default=None, max_length=500,
        pattern=r"^(?:/assets/images/[A-Za-z0-9_.-]+|/api/mushrooms/\d+/photo)$",
    )
    photo2: str | None = Field(
        default=None, max_length=500,
        pattern=r"^(?:/assets/images/[A-Za-z0-9_.-]+|/api/mushrooms/\d+/photo\?slot=2)$",
    )
    plate: str | None = Field(default=None, max_length=30)

    @field_validator("latin", "illustration", "photo", "photo2", "plate")
    @classmethod
    def optional_strings_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("Поле должно быть заполнено или равно null")
        return value


class MushroomCreate(MushroomFields):
    """Поля, обязательные при создании записи."""


class MushroomUpdate(BaseModel):
    """Частичное обновление одной или нескольких характеристик."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=2, max_length=100)
    latin: str | None = Field(default=None, min_length=3, max_length=120)
    family: str | None = Field(default=None, min_length=2, max_length=100)
    season: str | None = Field(default=None, min_length=3, max_length=100)
    category: MushroomCategory | None = None
    description: str | None = Field(default=None, min_length=10, max_length=700)
    illustration: str | None = Field(default=None, max_length=500)
    photo: str | None = Field(default=None, max_length=500)
    photo2: str | None = Field(default=None, max_length=500)
    plate: str | None = Field(default=None, max_length=30)

    @model_validator(mode="after")
    def check_patch_values(self) -> "MushroomUpdate":
        nullable_fields = {"latin", "illustration", "photo", "photo2", "plate"}
        for field in self.model_fields_set - nullable_fields:
            if getattr(self, field) is None:
                raise ValueError(f"Поле {field} не может быть null")
        return self


class MushroomRead(MushroomFields):
    """Публичная запись с идентификатором и временем создания."""

    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)

    id: int
    created_at: datetime
