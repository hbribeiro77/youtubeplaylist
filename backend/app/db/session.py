from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings
from app.db.fts import setup_fts
from app.db.migrations import run_sqlite_migrations
from app.db.models import Base

_engine = None
_SessionLocal = None


def _ensure_sqlite_directory(database_url: str) -> None:
    if database_url.startswith("sqlite:///./"):
        db_path = Path(database_url.replace("sqlite:///./", ""))
        db_path.parent.mkdir(parents=True, exist_ok=True)


def get_engine():
    global _engine, _SessionLocal
    if _engine is None:
        settings = get_settings()
        connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
        _ensure_sqlite_directory(settings.database_url)
        _engine = create_engine(settings.database_url, connect_args=connect_args)

        if settings.database_url.startswith("sqlite"):

            @event.listens_for(_engine, "connect")
            def set_sqlite_pragma(dbapi_connection, _connection_record):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.close()

        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine


def init_db() -> None:
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    run_sqlite_migrations(engine)
    setup_fts(engine)


def get_db() -> Generator[Session, None, None]:
    if _SessionLocal is None:
        get_engine()
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()


def reset_engine() -> None:
    global _engine, _SessionLocal
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _SessionLocal = None
