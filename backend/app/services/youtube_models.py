from dataclasses import dataclass


@dataclass
class YtVideoMetadata:
    youtube_video_id: str
    title: str
    description: str
    duration_seconds: int
    thumbnail_url: str
    tags: list[str]


@dataclass
class YtPlaylistMetadata:
    title: str
    videos: list[YtVideoMetadata]
    playlist_count: int | None = None
