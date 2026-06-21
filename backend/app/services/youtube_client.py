from dataclasses import dataclass
import logging
import re
from typing import Any

import httpx
import yt_dlp

logger = logging.getLogger(__name__)

VIDEO_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{11}$")

PIPED_API_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.leptons.xyz",
    "https://pipedapi.private.coffee",
    "https://pipedapi.tokhmi.xyz",
    "https://piped-api.lunar.icu",
]

PLAYLIST_PAGE_SIZE = 100
MAX_PLAYLIST_VIDEOS = 10_000


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


def normalize_video_id(entry: dict[str, Any]) -> str | None:
    video_id = entry.get("id")
    if video_id and VIDEO_ID_RE.match(str(video_id)):
        return str(video_id)

    for key in ("url", "webpage_url"):
        url = entry.get(key) or ""
        match = re.search(r"(?:v=|youtu\.be/|/shorts/|/embed/)([a-zA-Z0-9_-]{11})", url)
        if match:
            return match.group(1)
    return None


def _thumbnail_from_entry(entry: dict[str, Any], video_id: str) -> str:
    thumbnails = entry.get("thumbnails") or []
    if thumbnails:
        return thumbnails[-1].get("url") or f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"
    return f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"


def parse_ytdlp_entries(entries: list[Any]) -> list[YtVideoMetadata]:
    videos: list[YtVideoMetadata] = []
    for entry in entries:
        if not entry:
            continue
        video_id = normalize_video_id(entry)
        if not video_id:
            continue
        videos.append(
            YtVideoMetadata(
                youtube_video_id=video_id,
                title=entry.get("title") or "",
                description=entry.get("description") or "",
                duration_seconds=int(entry.get("duration") or 0),
                thumbnail_url=_thumbnail_from_entry(entry, video_id),
                tags=list(entry.get("tags") or []),
            )
        )
    return videos


def merge_video_lists(chunks: list[list[YtVideoMetadata]]) -> list[YtVideoMetadata]:
    seen: set[str] = set()
    merged: list[YtVideoMetadata] = []
    for chunk in chunks:
        for video in chunk:
            if video.youtube_video_id in seen:
                continue
            seen.add(video.youtube_video_id)
            merged.append(video)
    return merged


class YouTubeClient:
    """Busca metadados de playlists via yt-dlp (modo rápido) com fallback Piped."""

    def __init__(self, piped_instances: list[str] | None = None):
        self.piped_instances = piped_instances or PIPED_API_INSTANCES

    def fetch_playlist(self, playlist_id: str) -> YtPlaylistMetadata:
        errors: list[str] = []

        try:
            metadata = self._fetch_with_ytdlp_flat(playlist_id)
            if metadata.videos:
                return metadata
            errors.append("yt-dlp não retornou vídeos")
        except Exception as exc:
            logger.exception("Falha yt-dlp flat para playlist %s", playlist_id)
            errors.append(f"yt-dlp: {exc}")

        try:
            metadata = self._fetch_with_piped(playlist_id)
            if metadata.videos:
                return metadata
            errors.append("Piped não retornou vídeos")
        except Exception as exc:
            logger.exception("Falha Piped para playlist %s", playlist_id)
            errors.append(f"Piped: {exc}")

        detail = "; ".join(errors) if errors else "desconhecido"
        raise ValueError(
            "Não foi possível carregar a playlist. "
            "Confirme se ela é pública e tente novamente. "
            f"Detalhe: {detail}"
        )

    def _ytdlp_options(self, *, extract_flat: bool, playlist_start: int | None = None, playlist_end: int | None = None) -> dict[str, Any]:
        options: dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "ignoreerrors": True,
            "socket_timeout": 60,
            "retries": 3,
            "extract_flat": "in_playlist" if extract_flat else False,
            "extractor_args": {
                "youtube": {
                    "player_client": ["android", "web", "tv_embedded"],
                }
            },
        }
        if playlist_start is not None:
            options["playliststart"] = playlist_start
        if playlist_end is not None:
            options["playlistend"] = playlist_end
        return options

    def _fetch_with_ytdlp_flat(self, playlist_id: str) -> YtPlaylistMetadata:
        url = f"https://www.youtube.com/playlist?list={playlist_id}"
        title = "Playlist"
        chunks: list[list[YtVideoMetadata]] = []
        start = 1

        while start <= MAX_PLAYLIST_VIDEOS:
            end = start + PLAYLIST_PAGE_SIZE - 1
            with yt_dlp.YoutubeDL(self._ytdlp_options(extract_flat=True, playlist_start=start, playlist_end=end)) as ydl:
                info = ydl.extract_info(url, download=False)

            if not info:
                if start == 1:
                    raise ValueError("Playlist não encontrada")
                break

            if start == 1:
                title = info.get("title") or title

            entries = [entry for entry in (info.get("entries") or []) if entry]
            if not entries:
                break

            page_videos = parse_ytdlp_entries(entries)
            if not page_videos:
                break

            chunks.append(page_videos)
            logger.info(
                "Playlist %s: página %s-%s retornou %s vídeos",
                playlist_id,
                start,
                end,
                len(page_videos),
            )

            if len(entries) < PLAYLIST_PAGE_SIZE:
                break

            start += PLAYLIST_PAGE_SIZE

        videos = merge_video_lists(chunks)
        if not videos:
            raise ValueError("Playlist vazia ou inacessível")

        if len(videos) >= MAX_PLAYLIST_VIDEOS:
            logger.warning("Playlist %s atingiu limite de %s vídeos", playlist_id, MAX_PLAYLIST_VIDEOS)

        return YtPlaylistMetadata(title=title, videos=videos)

    def _fetch_with_piped(self, playlist_id: str) -> YtPlaylistMetadata:
        last_error: Exception | None = None

        for base in self.piped_instances:
            try:
                metadata = self._piped_fetch_instance(base, playlist_id)
                if metadata.videos:
                    return metadata
            except Exception as exc:
                last_error = exc
                logger.warning("Piped %s falhou: %s", base, exc)

        if last_error:
            raise last_error
        raise ValueError("Nenhuma instância Piped respondeu")

    def _piped_fetch_instance(self, base: str, playlist_id: str) -> YtPlaylistMetadata:
        videos: list[YtVideoMetadata] = []
        title = "Playlist"
        nextpage: str | None = None

        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            while True:
                if nextpage:
                    response = client.get(f"{base}/nextpage/playlists/{playlist_id}", params={"nextpage": nextpage})
                else:
                    response = client.get(f"{base}/playlists/{playlist_id}")

                response.raise_for_status()
                data = response.json()
                title = data.get("name") or title

                for stream in data.get("relatedStreams") or []:
                    url = stream.get("url") or ""
                    match = re.search(r"[?&]v=([a-zA-Z0-9_-]{11})", url)
                    if not match and url.startswith("/watch"):
                        match = re.search(r"/watch\?v=([a-zA-Z0-9_-]{11})", url)
                    video_id = match.group(1) if match else None
                    if not video_id:
                        continue
                    videos.append(
                        YtVideoMetadata(
                            youtube_video_id=video_id,
                            title=stream.get("title") or "",
                            description="",
                            duration_seconds=int(stream.get("duration") or 0),
                            thumbnail_url=stream.get("thumbnail")
                            or f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
                            tags=[],
                        )
                    )

                nextpage = data.get("nextpage")
                if not nextpage:
                    break

        return YtPlaylistMetadata(title=title, videos=videos)
