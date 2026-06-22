import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.models import Playlist, TranscriptStatus, Video
from app.db.fts import rebuild_fts_for_video
from app.services.transcript_service import fetch_transcript_text
from app.services.youtube_client import YouTubeClient

logger = logging.getLogger(__name__)


@dataclass
class SyncPlaylistResult:
    playlist: Playlist
    new_videos_added: int


class SyncService:
    def __init__(self, youtube_client: YouTubeClient | None = None):
        self.youtube = youtube_client or YouTubeClient()

    def sync_playlist(
        self,
        db: Session,
        youtube_playlist_id: str,
        is_default: bool = False,
    ) -> SyncPlaylistResult:
        metadata = self.youtube.fetch_playlist(youtube_playlist_id)

        playlist = db.query(Playlist).filter(Playlist.youtube_playlist_id == youtube_playlist_id).first()
        if playlist is None:
            playlist = Playlist(
                youtube_playlist_id=youtube_playlist_id,
                title=metadata.title,
                channel_name=metadata.channel_name,
                is_default=is_default,
            )
            db.add(playlist)
            db.flush()
        else:
            playlist.title = metadata.title
            if metadata.channel_name:
                playlist.channel_name = metadata.channel_name
            if is_default:
                playlist.is_default = True

        existing = {
            v.youtube_video_id: v
            for v in db.query(Video).filter(Video.playlist_id == playlist.id).all()
        }

        new_videos_added = 0

        for position, item in enumerate(metadata.videos):
            video = existing.get(item.youtube_video_id)
            tags = json.dumps(item.tags)

            if video is None:
                video = Video(
                    youtube_video_id=item.youtube_video_id,
                    playlist_id=playlist.id,
                    position=position,
                    title=item.title,
                    description=item.description,
                    duration_seconds=item.duration_seconds,
                    thumbnail_url=item.thumbnail_url,
                    tags_json=tags,
                    transcript_status=TranscriptStatus.pending,
                    is_new=True,
                    published_at=item.published_at,
                )
                db.add(video)
                db.flush()
                new_videos_added += 1
            else:
                video.position = position
                video.title = item.title
                video.description = item.description
                video.duration_seconds = item.duration_seconds
                video.thumbnail_url = item.thumbnail_url
                video.tags_json = tags
                if item.published_at is not None:
                    video.published_at = item.published_at

            transcript_text = video.transcript.text if video.transcript else ""
            rebuild_fts_for_video(
                db.connection(),
                video.id,
                video.title,
                video.description,
                video.tags_json,
                transcript_text,
                playlist.id,
            )

        playlist.last_synced_at = datetime.now(timezone.utc).replace(tzinfo=None)
        db.commit()
        db.refresh(playlist)
        return SyncPlaylistResult(playlist=playlist, new_videos_added=new_videos_added)

    def sync_transcripts_for_playlist(self, db: Session, playlist_id: int) -> None:
        videos = (
            db.query(Video)
            .filter(Video.playlist_id == playlist_id, Video.transcript_status == TranscriptStatus.pending)
            .all()
        )
        for video in videos:
            try:
                fetch_transcript_text(db, video)
            except Exception as exc:
                logger.warning("Falha ao buscar transcrição de %s: %s", video.youtube_video_id, exc)
                video.transcript_status = TranscriptStatus.unavailable
                db.commit()
