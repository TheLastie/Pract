"""Настройка SQLite и SQLAlchemy session dependency."""

import os
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATABASE = PROJECT_ROOT / "data" / "mushrooms.db"
DEFAULT_DATABASE.parent.mkdir(parents=True, exist_ok=True)
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DATABASE.as_posix()}")

engine_options = {
    "connect_args": {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
}
if DATABASE_URL in {"sqlite://", "sqlite:///:memory:"}:
    engine_options["poolclass"] = StaticPool

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Общая база для ORM-моделей."""


def get_db() -> Generator[Session, None, None]:
    """Выдаёт одну сессию на запрос и всегда закрывает её."""
    with SessionLocal() as session:
        yield session
