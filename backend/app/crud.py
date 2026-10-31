"""Database operations for mushroom records."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Mushroom
from .schemas import MushroomCreate, MushroomUpdate


def get_mushrooms(db: Session) -> list[Mushroom]:
    return list(db.scalars(select(Mushroom).order_by(Mushroom.id)).all())


def get_mushroom(db: Session, mushroom_id: int) -> Mushroom | None:
    return db.get(Mushroom, mushroom_id)


def create_mushroom(db: Session, data: MushroomCreate) -> Mushroom:
    mushroom = Mushroom(**data.model_dump())
    db.add(mushroom)
    db.commit()
    db.refresh(mushroom)
    return mushroom


def update_mushroom(db: Session, mushroom: Mushroom, data: MushroomUpdate) -> Mushroom:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(mushroom, field, value)
    db.commit()
    db.refresh(mushroom)
    return mushroom


def delete_mushroom(db: Session, mushroom: Mushroom) -> None:
    db.delete(mushroom)
    db.commit()
