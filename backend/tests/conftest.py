import pytest
from app.db.fts import rebuild_fts_for_video
from app.db.models import Playlist, Transcript, TranscriptStatus, Video

from fastapi.testclient import TestClient

from app.config import get_settings
from app.db.session import get_db, init_db, reset_engine
from app.main import create_app


def pytest_configure(config):
    config.addinivalue_line("markers", "live: testes que acessam serviços externos reais")


@pytest.fixture(autouse=True)
def test_env(monkeypatch, tmp_path):
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    get_settings.cache_clear()
    reset_engine()
    init_db()
    yield
    reset_engine()
    get_settings.cache_clear()


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    return TestClient(app)


@pytest.fixture
def db_session():
    from app.db.session import _SessionLocal, get_engine

    get_engine()
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def seed_playlist(db_session):
    playlist = Playlist(youtube_playlist_id="PLSEED", title="Seed", is_default=True)
    db_session.add(playlist)
    db_session.flush()

    videos = []
    items = [
        ("vid1", "Docker basics", "containers", '["docker"]', "texto sobre kubernetes aqui"),
        ("vid2", "Python 101", "intro python", '["python"]', ""),
        ("vid3", "Git workflow", "git na pratica", '["git"]', ""),
    ]
    for idx, (yt_id, title, desc, tags, transcript) in enumerate(items):
        video = Video(
            youtube_video_id=yt_id,
            playlist_id=playlist.id,
            position=idx,
            title=title,
            description=desc,
            duration_seconds=120 + idx,
            thumbnail_url=f"https://example.com/{yt_id}.jpg",
            tags_json=tags,
            transcript_status=TranscriptStatus.ok if transcript else TranscriptStatus.pending,
        )
        db_session.add(video)
        db_session.flush()
        if transcript:
            db_session.add(Transcript(video_id=video.id, language="pt", text=transcript))
        rebuild_fts_for_video(
            db_session.connection(),
            video.id,
            video.title,
            video.description,
            video.tags_json,
            transcript,
            playlist.id,
        )
        videos.append(video)

    db_session.commit()
    return {"playlist": playlist, "videos": videos, "search_term": "kubernetes"}
