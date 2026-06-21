import json
import logging
import re
from typing import Any

import httpx

from app.services.youtube_models import YtPlaylistMetadata, YtVideoMetadata

logger = logging.getLogger(__name__)

VIDEO_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{11}$")
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
MAX_PAGES = 200


def parse_duration_text(value: str) -> int:
    if not value:
        return 0
    parts = [int(part) for part in value.split(":") if part.isdigit()]
    if not parts:
        return 0
    seconds = 0
    for part in parts:
        seconds = seconds * 60 + part
    return seconds


def extract_ytinitial_data(html: str) -> dict[str, Any]:
    match = re.search(r"var ytInitialData = ({.*?});</script>", html)
    if not match:
        raise ValueError("ytInitialData não encontrado na página da playlist")
    return json.loads(match.group(1))


def extract_ytcfg(html: str) -> dict[str, Any]:
    match = re.search(r"ytcfg\.set\(({.*?})\);", html)
    if not match:
        raise ValueError("ytcfg não encontrado na página da playlist")
    return json.loads(match.group(1))


def parse_lockup(lockup: dict[str, Any]) -> YtVideoMetadata | None:
    video_id = lockup.get("contentId")
    if not video_id or not VIDEO_ID_RE.match(str(video_id)):
        thumbnail_sources = (
            lockup.get("contentImage", {})
            .get("thumbnailViewModel", {})
            .get("image", {})
            .get("sources", [])
        )
        video_id = None
        for source in thumbnail_sources:
            url = source.get("url", "")
            match = re.search(r"/vi/([a-zA-Z0-9_-]{11})/", url)
            if match:
                video_id = match.group(1)
                break
    if not video_id:
        return None

    metadata = lockup.get("metadata", {}).get("lockupMetadataViewModel", {})
    title = (
        metadata.get("title", {}).get("content")
        or metadata.get("title", {}).get("simpleText")
        or ""
    )

    duration_text = ""
    overlays = lockup.get("contentImage", {}).get("thumbnailViewModel", {}).get("overlays", [])
    for overlay in overlays:
        badges = overlay.get("thumbnailBottomOverlayViewModel", {}).get("badges", [])
        for badge in badges:
            text = badge.get("thumbnailBadgeViewModel", {}).get("text")
            if text:
                duration_text = text
                break

    thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"
    sources = (
        lockup.get("contentImage", {})
        .get("thumbnailViewModel", {})
        .get("image", {})
        .get("sources", [])
    )
    if sources:
        thumbnail_url = sources[-1].get("url", thumbnail_url)

    return YtVideoMetadata(
        youtube_video_id=video_id,
        title=title,
        description="",
        duration_seconds=parse_duration_text(duration_text),
        thumbnail_url=thumbnail_url,
        tags=[],
    )


def extract_lockups_from_browse(data: dict[str, Any]) -> list[YtVideoMetadata]:
    videos: list[YtVideoMetadata] = []

    def walk(obj: Any) -> None:
        if isinstance(obj, dict):
            if "lockupViewModel" in obj:
                parsed = parse_lockup(obj["lockupViewModel"])
                if parsed:
                    videos.append(parsed)
            for value in obj.values():
                walk(value)
        elif isinstance(obj, list):
            for value in obj:
                walk(value)

    walk(data)
    return videos


def find_continuation_token(data: dict[str, Any]) -> str | None:
    def walk(obj: Any) -> str | None:
        if isinstance(obj, dict):
            if "continuationItemViewModel" in obj:
                token = (
                    obj["continuationItemViewModel"]
                    .get("continuationCommand", {})
                    .get("innertubeCommand", {})
                    .get("continuationCommand", {})
                    .get("token")
                )
                if token:
                    return token
            for value in obj.values():
                found = walk(value)
                if found:
                    return found
        elif isinstance(obj, list):
            for value in obj:
                found = walk(value)
                if found:
                    return found
        return None

    return walk(data)


def extract_playlist_title_and_count(data: dict[str, Any]) -> tuple[str, int | None]:
    metadata_renderer = data.get("metadata", {}).get("playlistMetadataRenderer", {})
    page_header = data.get("header", {}).get("pageHeaderRenderer", {})
    legacy_header = data.get("header", {}).get("playlistHeaderRenderer", {})

    title = (
        page_header.get("pageTitle")
        or legacy_header.get("title", {}).get("simpleText")
        or metadata_renderer.get("title")
        or "Playlist"
    )

    playlist_count = metadata_renderer.get("totalVideos") or metadata_renderer.get("videoCount")
    if isinstance(playlist_count, str) and playlist_count.isdigit():
        playlist_count = int(playlist_count)

    if playlist_count is None:
        header_blob = json.dumps(page_header) + json.dumps(legacy_header)
        match = re.search(
            r'"content"\s*:\s*"(\d+)\s*(?:vídeos|videos|v\\u00eddeos)"',
            header_blob,
            re.IGNORECASE,
        )
        if match:
            playlist_count = int(match.group(1))

    if playlist_count is None:
        for text in _iter_text_contents(data.get("header", {})):
            match = re.search(r"(\d+)\s*(?:vídeos|videos)", text, re.IGNORECASE)
            if match:
                playlist_count = int(match.group(1))
                break

    return title, int(playlist_count) if playlist_count is not None else None


def _iter_text_contents(obj: Any):
    if isinstance(obj, dict):
        content = obj.get("content")
        if isinstance(content, str):
            yield content
        for value in obj.values():
            yield from _iter_text_contents(value)
    elif isinstance(obj, list):
        for value in obj:
            yield from _iter_text_contents(value)


class InnertubePlaylistClient:
    """Busca playlists grandes via API interna do YouTube (lockupViewModel + continuations)."""

    def __init__(self, timeout: float = 60.0):
        self.timeout = timeout

    def fetch_playlist(self, playlist_id: str) -> YtPlaylistMetadata:
        url = f"https://www.youtube.com/playlist?list={playlist_id}"

        with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
            response = client.get(url, headers={"User-Agent": USER_AGENT})
            response.raise_for_status()
            html = response.text

            initial_data = extract_ytinitial_data(html)
            ytcfg = extract_ytcfg(html)
            title, playlist_count = extract_playlist_title_and_count(initial_data)

            videos = self._collect_videos(client, ytcfg, initial_data)
            if not videos:
                raise ValueError("Nenhum vídeo encontrado na playlist")

            logger.info(
                "Playlist %s via Innertube: %s vídeos (playlist_count=%s)",
                playlist_id,
                len(videos),
                playlist_count,
            )
            return YtPlaylistMetadata(title=title, videos=videos, playlist_count=playlist_count)

    def _collect_videos(
        self,
        client: httpx.Client,
        ytcfg: dict[str, Any],
        initial_data: dict[str, Any],
    ) -> list[YtVideoMetadata]:
        seen: set[str] = set()
        ordered: list[YtVideoMetadata] = []

        def add_videos(batch: list[YtVideoMetadata]) -> int:
            added = 0
            for video in batch:
                if video.youtube_video_id in seen:
                    continue
                seen.add(video.youtube_video_id)
                ordered.append(video)
                added += 1
            return added

        add_videos(extract_lockups_from_browse(initial_data))

        token = find_continuation_token(initial_data)
        for page in range(2, MAX_PAGES + 1):
            if not token:
                break

            data = self._browse_continuation(client, ytcfg, token)
            added = add_videos(extract_lockups_from_browse(data))
            token = find_continuation_token(data)
            logger.debug("Innertube página %s: +%s vídeos (total %s)", page, added, len(ordered))

            if added == 0 and not token:
                break

        return ordered

    def _browse_continuation(
        self,
        client: httpx.Client,
        ytcfg: dict[str, Any],
        token: str,
    ) -> dict[str, Any]:
        api_key = ytcfg["INNERTUBE_API_KEY"]
        context = ytcfg.get("INNERTUBE_CONTEXT") or {
            "client": {"clientName": "WEB", "clientVersion": "2.20240101.00.00"}
        }
        client_version = context.get("client", {}).get("clientVersion", "")
        response = client.post(
            f"https://www.youtube.com/youtubei/v1/browse?key={api_key}",
            json={"context": context, "continuation": token},
            headers={
                "User-Agent": USER_AGENT,
                "Content-Type": "application/json",
                "X-YouTube-Client-Name": "1",
                "X-YouTube-Client-Version": client_version,
            },
        )
        response.raise_for_status()
        return response.json()
