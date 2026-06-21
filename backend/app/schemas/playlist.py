import json
import re
from datetime import datetime

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str


class PlaylistCreate(BaseModel):
    url_or_id: str = Field(min_length=3)


class PlaylistResponse(BaseModel):
    id: int
    youtube_playlist_id: str
    title: str
    is_default: bool
    last_synced_at: datetime | None
    video_count: int = 0

    model_config = {"from_attributes": True}


class VideoMomentResponse(BaseModel):
    id: int
    video_id: int
    position_seconds: int
    label: str

    model_config = {"from_attributes": True}


class VideoMomentCreate(BaseModel):
    position_seconds: int = Field(ge=0)
    label: str = Field(default="", max_length=256)


class VideoReplayUpdate(BaseModel):
    replay_enabled: bool | None = None
    replay_duration_seconds: int | None = None


class VideoResponse(BaseModel):
    id: int
    youtube_video_id: str
    playlist_id: int
    position: int
    title: str
    description: str
    duration_seconds: int
    thumbnail_url: str
    tags: list[str]
    transcript_status: str
    replay_enabled: bool = False
    replay_duration_seconds: int = 5
    moments: list[VideoMomentResponse] = []

    model_config = {"from_attributes": True}


class VideoDetailResponse(VideoResponse):
    transcript_text: str | None = None


def parse_playlist_id(url_or_id: str) -> str:
    value = url_or_id.strip()
    if re.fullmatch(r"PL[\w-]+", value):
        return value
    match = re.search(r"[?&]list=([^&]+)", value)
    if match:
        return match.group(1)
    raise ValueError("URL ou ID de playlist inválido")


def parse_tags(tags_json: str) -> list[str]:
    try:
        data = json.loads(tags_json or "[]")
        if isinstance(data, list):
            return [str(tag) for tag in data]
    except json.JSONDecodeError:
        pass
    return []
