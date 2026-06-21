import logging
import re
from typing import Any

import httpx
import yt_dlp

from app.services.innertube_playlist_client import InnertubePlaylistClient
from app.services.youtube_models import YtPlaylistMetadata, YtVideoMetadata

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


def materialize_ytdlp_entries(raw_entries: Any) -> list[Any]:
    """Força o yt-dlp a percorrer todas as páginas da playlist (continuations)."""
    if raw_entries is None:
        return []
    return [entry for entry in list(raw_entries) if entry]


def playlist_fetch_looks_truncated(metadata: YtPlaylistMetadata) -> bool:
    """Detecta quando o YouTube provavelmente cortou a lista em ~100 itens."""
    got = len(metadata.videos)
    expected = metadata.playlist_count
    if expected is not None:
        if got >= expected:
            return False
        if got > PLAYLIST_PAGE_SIZE + 1:
            return False
        return got < expected
    return got in (PLAYLIST_PAGE_SIZE, PLAYLIST_PAGE_SIZE + 1)


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
    """Busca metadados de playlists via Innertube, yt-dlp e Piped."""

    def __init__(
        self,
        piped_instances: list[str] | None = None,
        innertube_client: InnertubePlaylistClient | None = None,
    ):
        self.piped_instances = piped_instances or PIPED_API_INSTANCES
        self.innertube = innertube_client or InnertubePlaylistClient()

    def fetch_playlist(self, playlist_id: str) -> YtPlaylistMetadata:
        errors: list[str] = []
        candidates: list[YtPlaylistMetadata] = []

        try:
            innertube_meta = self.innertube.fetch_playlist(playlist_id)
            if innertube_meta.videos:
                candidates.append(innertube_meta)
                if not playlist_fetch_looks_truncated(innertube_meta):
                    return innertube_meta
                errors.append(
                    f"Innertube retornou apenas {len(innertube_meta.videos)} vídeos (possível truncamento)"
                )
            else:
                errors.append("Innertube não retornou vídeos")
        except Exception as exc:
            logger.exception("Falha Innertube para playlist %s", playlist_id)
            errors.append(f"Innertube: {exc}")

        try:
            ytdlp_meta = self._fetch_with_ytdlp_flat(playlist_id)
            if ytdlp_meta.videos:
                candidates.append(ytdlp_meta)
                if not playlist_fetch_looks_truncated(ytdlp_meta):
                    return ytdlp_meta
                errors.append(f"yt-dlp retornou apenas {len(ytdlp_meta.videos)} vídeos (possível truncamento)")
            else:
                errors.append("yt-dlp não retornou vídeos")
        except Exception as exc:
            logger.exception("Falha yt-dlp flat para playlist %s", playlist_id)
            errors.append(f"yt-dlp: {exc}")

        try:
            piped_meta = self._fetch_with_piped(playlist_id)
            if piped_meta.videos:
                candidates.append(piped_meta)
            else:
                errors.append("Piped não retornou vídeos")
        except Exception as exc:
            logger.exception("Falha Piped para playlist %s", playlist_id)
            errors.append(f"Piped: {exc}")

        if candidates:
            best = max(candidates, key=lambda meta: len(meta.videos))
            logger.info(
                "Playlist %s: melhor resultado com %s vídeos (candidatos: %s)",
                playlist_id,
                len(best.videos),
                ", ".join(str(len(meta.videos)) for meta in candidates),
            )
            return best

        detail = "; ".join(errors) if errors else "desconhecido"
        raise ValueError(
            "Não foi possível carregar a playlist. "
            "Confirme se ela é pública e tente novamente. "
            f"Detalhe: {detail}"
        )

    def _ytdlp_options(
        self,
        *,
        extract_flat: bool,
        playlist_start: int | None = None,
        playlist_end: int | None = None,
    ) -> dict[str, Any]:
        options: dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "ignoreerrors": True,
            "lazy_playlist": False,
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

        with yt_dlp.YoutubeDL(self._ytdlp_options(extract_flat=True)) as ydl:
            info = ydl.extract_info(url, download=False)

        if not info:
            raise ValueError("Playlist não encontrada")

        title = info.get("title") or "Playlist"
        playlist_count = info.get("playlist_count")
        entries = materialize_ytdlp_entries(info.get("entries"))
        videos = parse_ytdlp_entries(entries)

        logger.info(
            "Playlist %s: extração completa retornou %s vídeos (playlist_count=%s)",
            playlist_id,
            len(videos),
            playlist_count,
        )

        if not videos:
            raise ValueError("Playlist vazia ou inacessível")

        if playlist_fetch_looks_truncated(
            YtPlaylistMetadata(title=title, videos=videos, playlist_count=playlist_count)
        ):
            extra_videos = self._fetch_with_ytdlp_paged(playlist_id, skip=len(videos))
            if extra_videos:
                videos = merge_video_lists([videos, extra_videos])
                logger.info(
                    "Playlist %s: paginação complementar elevou total para %s vídeos",
                    playlist_id,
                    len(videos),
                )

        if len(videos) >= MAX_PLAYLIST_VIDEOS:
            logger.warning("Playlist %s atingiu limite de %s vídeos", playlist_id, MAX_PLAYLIST_VIDEOS)
            videos = videos[:MAX_PLAYLIST_VIDEOS]

        return YtPlaylistMetadata(title=title, videos=videos, playlist_count=playlist_count)

    def _fetch_with_ytdlp_paged(self, playlist_id: str, skip: int) -> list[YtVideoMetadata]:
        """Fallback: busca páginas adicionais quando a extração única parece truncada."""
        url = f"https://www.youtube.com/playlist?list={playlist_id}"
        chunks: list[list[YtVideoMetadata]] = []
        start = skip + 1

        while start <= MAX_PLAYLIST_VIDEOS:
            end = start + PLAYLIST_PAGE_SIZE - 1
            with yt_dlp.YoutubeDL(
                self._ytdlp_options(extract_flat=True, playlist_start=start, playlist_end=end)
            ) as ydl:
                info = ydl.extract_info(url, download=False)

            if not info:
                break

            entries = materialize_ytdlp_entries(info.get("entries"))
            page_videos = parse_ytdlp_entries(entries)
            if not page_videos:
                break

            chunks.append(page_videos)
            logger.info(
                "Playlist %s: página complementar %s-%s retornou %s vídeos",
                playlist_id,
                start,
                end,
                len(page_videos),
            )

            if len(page_videos) < PLAYLIST_PAGE_SIZE:
                break

            start += len(page_videos)

        return merge_video_lists(chunks)

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

    def _piped_stream_video_id(self, stream: dict[str, Any]) -> str | None:
        stream_id = stream.get("id") or stream.get("videoId")
        if stream_id and VIDEO_ID_RE.match(str(stream_id)):
            return str(stream_id)

        url = stream.get("url") or ""
        match = re.search(r"(?:[?&]v=|/shorts/|youtu\.be/)([a-zA-Z0-9_-]{11})", url)
        if match:
            return match.group(1)
        if url.startswith("/watch"):
            match = re.search(r"/watch\?v=([a-zA-Z0-9_-]{11})", url)
            if match:
                return match.group(1)
        return None

    def _piped_fetch_instance(self, base: str, playlist_id: str) -> YtPlaylistMetadata:
        videos: list[YtVideoMetadata] = []
        title = "Playlist"
        nextpage: str | None = None

        with httpx.Client(timeout=60.0, follow_redirects=True) as client:
            while len(videos) < MAX_PLAYLIST_VIDEOS:
                if nextpage:
                    response = client.get(
                        f"{base}/nextpage/playlists/{playlist_id}",
                        params={"nextpage": nextpage},
                    )
                else:
                    response = client.get(f"{base}/playlists/{playlist_id}")

                response.raise_for_status()
                data = response.json()
                title = data.get("name") or title

                for stream in data.get("relatedStreams") or []:
                    video_id = self._piped_stream_video_id(stream)
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

        if len(videos) >= MAX_PLAYLIST_VIDEOS:
            videos = videos[:MAX_PLAYLIST_VIDEOS]

        return YtPlaylistMetadata(title=title, videos=videos)
