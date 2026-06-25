from pathlib import Path
from typing import AsyncGenerator

from fastapi import Request
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

_SQL_ROOT = Path(__file__).parent / "sql"


class Base(DeclarativeBase):
    pass


def make_engine(url: str) -> AsyncEngine:
    """Cria engine SQLAlchemy Async — usar URL do tipo sqlite+aiosqlite:///path."""
    return create_async_engine(url, echo=False, future=True)


def make_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def load_sql(relative_path: str) -> str:
    """Carrega arquivo .sql de backend/src/pija/sql/."""
    path = _SQL_ROOT / relative_path
    if not path.exists():
        raise FileNotFoundError(f"SQL file not found: {path}")
    return path.read_text(encoding="utf-8")


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields AsyncSession do engine registrado no app state."""
    async with request.app.state.session_factory() as session:
        yield session