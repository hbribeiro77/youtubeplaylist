from dataclasses import dataclass
from datetime import datetime


@dataclass
class YtVideoMetadata:
    youtube_video_id: str
    title: str
    description: str
    duration_seconds: int
    thumbnail_url: str
    tags: list[str]
    published_at: datetime | None = None


@dataclass
class YtPlaylistMetadata:
    title: str
    videos: list[YtVideoMetadata]
    playlist_count: int | None = None
    channel_name: str = ""
