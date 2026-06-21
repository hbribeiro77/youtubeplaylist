import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.fts import rebuild_fts_for_video
from app.db.models import Playlist, Transcript, TranscriptStatus, Video
from app.db.session import get_db

router = APIRouter(prefix="/test", tags=["test"])

SEED_PLAYLIST_YOUTUBE_ID = "PLTEST123"
SEED_TERM = "kubernetes"


@router.post("/seed")
def seed_test_data(db: Session = Depends(get_db)) -> dict:
    playlist = db.query(Playlist).filter(Playlist.youtube_playlist_id == SEED_PLAYLIST_YOUTUBE_ID).first()
    if playlist is None:
        playlist = Playlist(
            youtube_playlist_id=SEED_PLAYLIST_YOUTUBE_ID,
            title="Playlist de Teste",
            is_default=True,
        )
        db.add(playlist)
        db.flush()

    videos_data = [
        {
            "youtube_video_id": "dQw4w9WgXcQ",
            "position": 0,
            "title": "Introdução ao Docker",
            "description": "Aprenda containers do zero",
            "duration_seconds": 212,
            "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
            "tags_json": json.dumps(["docker", "devops"]),
            "transcript_status": TranscriptStatus.ok,
            "transcript": "Nesta aula falamos sobre kubernetes e containers",
        },
        {
            "youtube_video_id": "abc123def45",
            "position": 1,
            "title": "Python para iniciantes",
            "description": "Primeiros passos em Python",
            "duration_seconds": 600,
            "thumbnail_url": "https://i.ytimg.com/vi/abc123def45/mqdefault.jpg",
            "tags_json": json.dumps(["python", "programacao"]),
            "transcript_status": TranscriptStatus.pending,
            "transcript": None,
        },
        {
            "youtube_video_id": "xyz987uvw65",
            "position": 2,
            "title": "Git e GitHub",
            "description": "Controle de versão na prática",
            "duration_seconds": 480,
            "thumbnail_url": "https://i.ytimg.com/vi/xyz987uvw65/mqdefault.jpg",
            "tags_json": json.dumps(["git", "github"]),
            "transcript_status": TranscriptStatus.unavailable,
            "transcript": None,
        },
    ]

    for data in videos_data:
        video = (
            db.query(Video)
            .filter(Video.playlist_id == playlist.id, Video.youtube_video_id == data["youtube_video_id"])
            .first()
        )
        if video is None:
            video = Video(
                youtube_video_id=data["youtube_video_id"],
                playlist_id=playlist.id,
                position=data["position"],
                title=data["title"],
                description=data["description"],
                duration_seconds=data["duration_seconds"],
                thumbnail_url=data["thumbnail_url"],
                tags_json=data["tags_json"],
                transcript_status=data["transcript_status"],
            )
            db.add(video)
            db.flush()
        else:
            video.position = data["position"]
            video.title = data["title"]
            video.description = data["description"]
            video.duration_seconds = data["duration_seconds"]
            video.thumbnail_url = data["thumbnail_url"]
            video.tags_json = data["tags_json"]
            video.transcript_status = data["transcript_status"]

        transcript_text = ""
        if data["transcript"]:
            if video.transcript is None:
                video.transcript = Transcript(
                    video_id=video.id, language="pt", text=data["transcript"]
                )
                db.add(video.transcript)
            else:
                video.transcript.text = data["transcript"]
            transcript_text = data["transcript"]

        rebuild_fts_for_video(
            db.connection(),
            video.id,
            video.title,
            video.description,
            video.tags_json,
            transcript_text,
            playlist.id,
        )

    db.commit()
    return {"playlist_id": playlist.id, "seed_term": SEED_TERM}
