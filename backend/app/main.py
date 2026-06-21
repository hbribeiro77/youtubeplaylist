from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import health, playlists, test_seed, videos
from app.config import get_settings
from app.db.session import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


def _mount_frontend(app: FastAPI, static_dir: Path) -> None:
    if not static_dir.exists():
        return
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="YouTube Playlist", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(playlists.router)
    app.include_router(videos.router)
    if settings.is_test:
        app.include_router(test_seed.router)

    _mount_frontend(app, settings.frontend_dist)

    return app


app = create_app()
