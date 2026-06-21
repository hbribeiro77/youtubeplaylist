from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.models import Video
from app.db.session import get_db
from app.schemas.playlist import VideoDetailResponse, VideoResponse, parse_tags
from app.services.search_service import search_videos

router = APIRouter(tags=["videos"])


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
    )


@router.get("/playlists/{playlist_id}/videos", response_model=list[VideoResponse])
def list_playlist_videos(
    playlist_id: int,
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[VideoResponse]:
    videos = search_videos(db, playlist_id, q)
    return [_to_video_response(v) for v in videos]


@router.get("/videos/{video_id}", response_model=VideoDetailResponse)
def get_video(video_id: int, db: Session = Depends(get_db)) -> VideoDetailResponse:
    video = db.query(Video).filter(Video.id == video_id).first()
    if video is None:
        raise HTTPException(status_code=404, detail="Vídeo não encontrado")

    response = VideoDetailResponse(
        **_to_video_response(video).model_dump(),
        transcript_text=video.transcript.text if video.transcript else None,
    )
    return response
