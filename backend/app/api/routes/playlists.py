from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import Playlist, Video
from app.db.session import get_db
from app.schemas.playlist import (
    AcknowledgeAllNewResponse,
    PlaylistCreate,
    PlaylistResponse,
    PlaylistSyncResponse,
    parse_playlist_id,
)
from app.services.sync_service import SyncService

router = APIRouter(prefix="/playlists", tags=["playlists"])


def _count_new_videos(db: Session, playlist_id: int) -> int:
    return (
        db.query(Video)
        .filter(Video.playlist_id == playlist_id, Video.is_new.is_(True))
        .count()
    )


def _to_response(playlist: Playlist, db: Session) -> PlaylistResponse:
    count = db.query(Video).filter(Video.playlist_id == playlist.id).count()
    new_count = _count_new_videos(db, playlist.id)
    return PlaylistResponse(
        id=playlist.id,
        youtube_playlist_id=playlist.youtube_playlist_id,
        title=playlist.title,
        channel_name=playlist.channel_name or "",
        is_default=playlist.is_default,
        last_synced_at=playlist.last_synced_at,
        video_count=count,
        new_video_count=new_count,
    )


def _to_sync_response(playlist: Playlist, db: Session, new_videos_added: int) -> PlaylistSyncResponse:
    base = _to_response(playlist, db)
    return PlaylistSyncResponse(**base.model_dump(), new_videos_added=new_videos_added)


@router.get("", response_model=list[PlaylistResponse])
def list_playlists(db: Session = Depends(get_db)) -> list[PlaylistResponse]:
    playlists = db.query(Playlist).order_by(Playlist.is_default.desc(), Playlist.id.asc()).all()
    return [_to_response(p, db) for p in playlists]


@router.post("/acknowledge-all-new", response_model=AcknowledgeAllNewResponse)
def acknowledge_all_new_videos(db: Session = Depends(get_db)) -> AcknowledgeAllNewResponse:
    cleared_count = (
        db.query(Video)
        .filter(Video.is_new.is_(True))
        .update({Video.is_new: False}, synchronize_session=False)
    )
    db.commit()
    return AcknowledgeAllNewResponse(cleared_count=cleared_count)


@router.post("", response_model=PlaylistSyncResponse, status_code=201)
def create_playlist(
    payload: PlaylistCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> PlaylistSyncResponse:
    try:
        youtube_playlist_id = parse_playlist_id(payload.url_or_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    settings = get_settings()
    is_default = youtube_playlist_id == settings.default_playlist_id and bool(settings.default_playlist_id)

    try:
        result = SyncService().sync_playlist(db, youtube_playlist_id, is_default=is_default)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erro ao sincronizar playlist: {exc}") from exc

    background_tasks.add_task(_sync_transcripts, result.playlist.id)
    return _to_sync_response(result.playlist, db, result.new_videos_added)


@router.get("/{playlist_id}", response_model=PlaylistResponse)
def get_playlist(playlist_id: int, db: Session = Depends(get_db)) -> PlaylistResponse:
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if playlist is None:
        raise HTTPException(status_code=404, detail="Playlist não encontrada")
    return _to_response(playlist, db)


@router.delete("/{playlist_id}", status_code=204)
def delete_playlist(playlist_id: int, db: Session = Depends(get_db)) -> None:
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if playlist is None:
        raise HTTPException(status_code=404, detail="Playlist não encontrada")
    db.delete(playlist)
    db.commit()


@router.post("/{playlist_id}/sync", response_model=PlaylistSyncResponse)
def sync_playlist(
    playlist_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> PlaylistSyncResponse:
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if playlist is None:
        raise HTTPException(status_code=404, detail="Playlist não encontrada")

    try:
        result = SyncService().sync_playlist(db, playlist.youtube_playlist_id, is_default=playlist.is_default)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erro ao sincronizar playlist: {exc}") from exc

    background_tasks.add_task(_sync_transcripts, result.playlist.id)
    return _to_sync_response(result.playlist, db, result.new_videos_added)


def _sync_transcripts(playlist_id: int) -> None:
    from app.db.session import _SessionLocal, get_engine

    get_engine()
    db = _SessionLocal()
    try:
        SyncService().sync_transcripts_for_playlist(db, playlist_id)
    finally:
        db.close()
