from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db.models import Video
from app.db.session import get_db
from app.schemas.playlist import (
    VideoDetailResponse,
    VideoMomentCreate,
    VideoMomentResponse,
    VideoReplayUpdate,
    VideoResponse,
    parse_tags,
)
from app.db.migrations import (
    DEFAULT_LOOP_COUNT,
    DEFAULT_REPLAY_DURATION_SECONDS,
    INFINITE_LOOP_COUNT,
    LOOP_COUNT_OPTIONS,
    REPLAY_DURATION_OPTIONS,
)
from app.services.search_service import search_videos
from app.services.video_moment_service import create_moment, delete_moment, get_video_or_none

router = APIRouter(tags=["videos"])


def _moment_to_response(moment) -> VideoMomentResponse:
    return VideoMomentResponse(
        id=moment.id,
        video_id=moment.video_id,
        position_seconds=moment.position_seconds,
        label=moment.label or "",
    )


def _to_video_response(video: Video) -> VideoResponse:
    return VideoResponse(
        id=video.id,
        youtube_video_id=video.youtube_video_id,
        playlist_id=video.playlist_id,
        position=video.position,
        title=video.title,
        description=video.description,
        duration_seconds=video.duration_seconds,
        thumbnail_url=video.thumbnail_url,
        tags=parse_tags(video.tags_json),
        transcript_status=video.transcript_status.value,
        replay_enabled=video.replay_enabled,
        replay_duration_seconds=video.replay_duration_seconds,
        loop_enabled=video.loop_enabled,
        loop_count=video.loop_count,
        is_new=video.is_new,
        moments=[_moment_to_response(moment) for moment in video.moments],
    )


@router.get("/playlists/{playlist_id}/videos", response_model=list[VideoResponse])
def list_playlist_videos(
    playlist_id: int,
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[VideoResponse]:
    videos = search_videos(db, playlist_id, q)
    if not videos:
        return []

    video_ids = [video.id for video in videos]
    videos_with_moments = (
        db.query(Video)
        .options(joinedload(Video.moments))
        .filter(Video.id.in_(video_ids))
        .all()
    )
    moments_by_id = {video.id: video for video in videos_with_moments}

    ordered: list[VideoResponse] = []
    for video in videos:
        loaded = moments_by_id.get(video.id, video)
        ordered.append(_to_video_response(loaded))
    return ordered


@router.get("/videos/{video_id}", response_model=VideoDetailResponse)
def get_video(video_id: int, db: Session = Depends(get_db)) -> VideoDetailResponse:
    video = (
        db.query(Video)
        .options(joinedload(Video.moments))
        .filter(Video.id == video_id)
        .first()
    )
    if video is None:
        raise HTTPException(status_code=404, detail="Vídeo não encontrado")

    response = VideoDetailResponse(
        **_to_video_response(video).model_dump(),
        transcript_text=video.transcript.text if video.transcript else None,
    )
    return response


@router.post("/videos/{video_id}/moments", response_model=VideoMomentResponse)
def add_video_moment(
    video_id: int,
    payload: VideoMomentCreate,
    db: Session = Depends(get_db),
) -> VideoMomentResponse:
    video = get_video_or_none(db, video_id)
    if video is None:
        raise HTTPException(status_code=404, detail="Vídeo não encontrado")

    if video.duration_seconds > 0 and payload.position_seconds > video.duration_seconds:
        raise HTTPException(status_code=400, detail="Momento além da duração do vídeo")

    moment = create_moment(
        db,
        video,
        position_seconds=payload.position_seconds,
        label=payload.label,
    )
    return _moment_to_response(moment)


@router.delete("/videos/{video_id}/moments/{moment_id}", status_code=204)
def remove_video_moment(
    video_id: int,
    moment_id: int,
    db: Session = Depends(get_db),
) -> None:
    video = get_video_or_none(db, video_id)
    if video is None:
        raise HTTPException(status_code=404, detail="Vídeo não encontrado")

    if not delete_moment(db, video, moment_id):
        raise HTTPException(status_code=404, detail="Momento não encontrado")


@router.patch("/videos/{video_id}/replay", response_model=VideoResponse)
def update_video_replay_settings(
    video_id: int,
    payload: VideoReplayUpdate,
    db: Session = Depends(get_db),
) -> VideoResponse:
    video = (
        db.query(Video)
        .options(joinedload(Video.moments))
        .filter(Video.id == video_id)
        .first()
    )
    if video is None:
        raise HTTPException(status_code=404, detail="Vídeo não encontrado")

    if payload.replay_enabled is not None:
        video.replay_enabled = payload.replay_enabled

    if payload.loop_enabled is not None:
        video.loop_enabled = payload.loop_enabled
        if payload.loop_enabled:
            video.loop_count = INFINITE_LOOP_COUNT
        elif payload.loop_count is None:
            video.loop_count = DEFAULT_LOOP_COUNT

    if payload.loop_count is not None:
        if payload.loop_count not in LOOP_COUNT_OPTIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Repetições de loop inválidas. Use: {', '.join(map(str, LOOP_COUNT_OPTIONS))}",
            )
        video.loop_count = payload.loop_count
        video.loop_enabled = payload.loop_count != DEFAULT_LOOP_COUNT

    if payload.replay_duration_seconds is not None:
        if payload.replay_duration_seconds not in REPLAY_DURATION_OPTIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Duração de replay inválida. Use: {', '.join(map(str, REPLAY_DURATION_OPTIONS))}",
            )
        video.replay_duration_seconds = payload.replay_duration_seconds

    if video.replay_duration_seconds not in REPLAY_DURATION_OPTIONS:
        video.replay_duration_seconds = DEFAULT_REPLAY_DURATION_SECONDS

    if video.loop_count not in LOOP_COUNT_OPTIONS:
        video.loop_count = DEFAULT_LOOP_COUNT

    db.commit()
    db.refresh(video)
    return _to_video_response(video)


@router.patch("/videos/{video_id}/acknowledge-new", response_model=VideoResponse)
def acknowledge_new_video(video_id: int, db: Session = Depends(get_db)) -> VideoResponse:
    video = (
        db.query(Video)
        .options(joinedload(Video.moments))
        .filter(Video.id == video_id)
        .first()
    )
    if video is None:
        raise HTTPException(status_code=404, detail="Vídeo não encontrado")

    video.is_new = False
    db.commit()
    db.refresh(video)
    return _to_video_response(video)
