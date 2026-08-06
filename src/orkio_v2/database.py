from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from .config import get_settings

class Base(DeclarativeBase):
    pass

def make_engine(url: str | None = None):
    value = url or get_settings().database_url
    kwargs = {"connect_args": {"check_same_thread": False}} if value.startswith("sqlite") else {}
    return create_engine(value, pool_pre_ping=True, **kwargs)

engine = make_engine()
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
