"""SQLAlchemy models for the mushroom reference catalog."""

from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, deferred, mapped_column

from .database import Base


class Mushroom(Base):
    """Одна запись грибного справочника."""

    __tablename__ = "mushrooms"
    __table_args__ = (
        CheckConstraint("category IN ('edible', 'poisonous', 'unknown')", name="ck_mushrooms_category"),
        CheckConstraint("length(name) BETWEEN 2 AND 100", name="ck_mushrooms_name_length"),
        CheckConstraint("length(family) BETWEEN 2 AND 100", name="ck_mushrooms_family_length"),
        CheckConstraint("length(season) BETWEEN 3 AND 100", name="ck_mushrooms_season_length"),
        CheckConstraint("length(description) BETWEEN 10 AND 700", name="ck_mushrooms_description_length"),
        Index("ix_mushrooms_category", "category"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    latin: Mapped[str | None] = mapped_column(String(120), nullable=True)
    family: Mapped[str] = mapped_column(String(100), nullable=False)
    season: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    illustration: Mapped[str | None] = mapped_column(String(500), nullable=True)
    photo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    photo_data: Mapped[bytes | None] = deferred(mapped_column(LargeBinary, nullable=True))
    photo2: Mapped[str | None] = mapped_column(String(500), nullable=True)
    photo_data_2: Mapped[bytes | None] = deferred(mapped_column(LargeBinary, nullable=True))
    plate: Mapped[str | None] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
