from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import Playlist
from app.db.session import get_db
from app.schemas.playlist import PlaylistCreate, PlaylistResponse, parse_playlist_id
from app.services.sync_service import SyncService

router = APIRouter(prefix="/playlists", tags=["playlists"])


def _to_response(playlist: Playlist, db: Session) -> PlaylistResponse:
    from app.db.models import Video

    count = db.query(Video).filter(Video.playlist_id == playlist.id).count()
    return PlaylistResponse(
        id=playlist.id,
        youtube_playlist_id=playlist.youtube_playlist_id,
        title=playlist.title,
        is_default=playlist.is_default,
        last_synced_at=playlist.last_synced_at,
        video_count=count,
    )


@router.get("", response_model=list[PlaylistResponse])
def list_playlists(db: Session = Depends(get_db)) -> list[PlaylistResponse]:
    playlists = db.query(Playlist).order_by(Playlist.is_default.desc(), Playlist.id.asc()).all()
    return [_to_response(p, db) for p in playlists]


@router.post("", response_model=PlaylistResponse, status_code=201)
def create_playlist(
    payload: PlaylistCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> PlaylistResponse:
    try:
        youtube_playlist_id = parse_playlist_id(payload.url_or_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    settings = get_settings()
    is_default = youtube_playlist_id == settings.default_playlist_id and bool(settings.default_playlist_id)

    try:
        playlist = SyncService().sync_playlist(db, youtube_playlist_id, is_default=is_default)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erro ao sincronizar playlist: {exc}") from exc

    background_tasks.add_task(_sync_transcripts, playlist.id)
    return _to_response(playlist, db)


@router.get("/{playlist_id}", response_model=PlaylistResponse)
def get_playlist(playlist_id: int, db: Session = Depends(get_db)) -> PlaylistResponse:
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if playlist is None:
        raise HTTPException(status_code=404, detail="Playlist não encontrada")
    return _to_response(playlist, db)


@router.post("/{playlist_id}/sync", response_model=PlaylistResponse)
def sync_playlist(
    playlist_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> PlaylistResponse:
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if playlist is None:
        raise HTTPException(status_code=404, detail="Playlist não encontrada")

    try:
        playlist = SyncService().sync_playlist(db, playlist.youtube_playlist_id, is_default=playlist.is_default)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erro ao sincronizar playlist: {exc}") from exc

    background_tasks.add_task(_sync_transcripts, playlist.id)
    return _to_response(playlist, db)


def _sync_transcripts(playlist_id: int) -> None:
    from app.db.session import _SessionLocal, get_engine

    get_engine()
    db = _SessionLocal()
    try:
        SyncService().sync_transcripts_for_playlist(db, playlist_id)
    finally:
        db.close()
