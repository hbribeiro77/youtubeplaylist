from dataclasses import dataclass
import re

import yt_dlp

VIDEO_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{11}$")


def normalize_video_id(entry: dict) -> str | None:
    video_id = entry.get("id")
    if video_id and VIDEO_ID_RE.match(str(video_id)):
        return str(video_id)

    for key in ("url", "webpage_url"):
        url = entry.get(key) or ""
        match = re.search(r"(?:v=|youtu\.be/|/shorts/|/embed/)([a-zA-Z0-9_-]{11})", url)
        if match:
            return match.group(1)
    return None


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


class YouTubeClient:
    """Busca metadados de playlists via yt-dlp, sem API key do Google."""

    def fetch_playlist(self, playlist_id: str) -> YtPlaylistMetadata:
        url = f"https://www.youtube.com/playlist?list={playlist_id}"
        options = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "ignoreerrors": True,
            "extract_flat": False,
        }

        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=False)

        if not info:
            raise ValueError("Playlist não encontrada")

        videos: list[YtVideoMetadata] = []
        for entry in info.get("entries") or []:
            if not entry:
                continue
            video_id = normalize_video_id(entry)
            if not video_id:
                continue

            thumbnails = entry.get("thumbnails") or []
            thumbnail_url = (
                thumbnails[-1].get("url")
                if thumbnails
                else f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"
            )

            videos.append(
                YtVideoMetadata(
                    youtube_video_id=video_id,
                    title=entry.get("title") or "",
                    description=entry.get("description") or "",
                    duration_seconds=int(entry.get("duration") or 0),
                    thumbnail_url=thumbnail_url,
                    tags=list(entry.get("tags") or []),
                )
            )

        if not videos:
            raise ValueError("Playlist vazia ou inacessível")

        return YtPlaylistMetadata(title=info.get("title") or "Playlist", videos=videos)
