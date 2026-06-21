from unittest.mock import MagicMock, patch

import pytest

from app.services.youtube_client import (
    YouTubeClient,
    materialize_ytdlp_entries,
    merge_video_lists,
    normalize_video_id,
    parse_ytdlp_entries,
    playlist_fetch_looks_truncated,
)
from app.services.youtube_models import YtPlaylistMetadata, YtVideoMetadata


def test_normalize_video_id_from_flat_entry():
    entry = {"id": "dQw4w9WgXcQ", "title": "Test"}
    assert normalize_video_id(entry) == "dQw4w9WgXcQ"


def test_parse_ytdlp_flat_entries():
    entries = [
        {
            "id": "6Y4mgeGf2xQ",
            "title": "Video 1",
            "duration": 120,
            "thumbnails": [{"url": "https://img/1.jpg"}],
        },
        {"id": "invalid", "title": "skip"},
    ]
    videos = parse_ytdlp_entries(entries)
    assert len(videos) == 1
    assert videos[0].youtube_video_id == "6Y4mgeGf2xQ"
    assert videos[0].duration_seconds == 120
    assert videos[0].thumbnail_url == "https://img/1.jpg"


def test_merge_video_lists_deduplicates():
    first = [
        YtVideoMetadata("aaa111aaa11", "A", "", 10, "", []),
        YtVideoMetadata("bbb222bbb22", "B", "", 20, "", []),
    ]
    second = [
        YtVideoMetadata("bbb222bbb22", "B dup", "", 20, "", []),
        YtVideoMetadata("ccc333ccc33", "C", "", 30, "", []),
    ]
    merged = merge_video_lists([first, second])
    assert [video.youtube_video_id for video in merged] == ["aaa111aaa11", "bbb222bbb22", "ccc333ccc33"]


def test_materialize_ytdlp_entries_consumes_generator():
    entries = materialize_ytdlp_entries(({"id": "aaa111aaa11", "title": "A"}, {"id": "bbb222bbb22", "title": "B"}))
    assert len(entries) == 2


@pytest.mark.parametrize(
    ("count", "videos", "truncated"),
    [
        (900, 101, True),
        (900, 900, False),
        (820, 736, False),
        (50, 50, False),
        (None, 100, True),
        (None, 101, True),
        (None, 150, False),
    ],
)
def test_playlist_fetch_looks_truncated(count, videos, truncated):
    meta = YtPlaylistMetadata(
        title="Test",
        videos=[YtVideoMetadata("a" * 11, "t", "", 0, "", [])] * videos,
        playlist_count=count,
    )
    assert playlist_fetch_looks_truncated(meta) is truncated


def test_fetch_playlist_uses_piped_when_ytdlp_truncated():
    client = YouTubeClient(piped_instances=["https://piped.test"])

    ytdlp_meta = YtPlaylistMetadata(
        title="Truncada",
        videos=[YtVideoMetadata("a" * 11, "t", "", 0, "", [])] * 101,
        playlist_count=900,
    )
    piped_meta = YtPlaylistMetadata(
        title="Completa",
        videos=[YtVideoMetadata("b" * 11, "t", "", 0, "", [])] * 250,
        playlist_count=900,
    )

    with patch.object(client, "_fetch_with_ytdlp_flat", return_value=ytdlp_meta):
        with patch.object(client, "_fetch_with_piped", return_value=piped_meta):
            result = client.fetch_playlist("PLtest")

    assert len(result.videos) == 250


def test_fetch_with_ytdlp_flat_materializes_all_entries():
    client = YouTubeClient()

    def fake_extract(url, download=False):
        return {
            "title": "Grande",
            "playlist_count": 3,
            "entries": (
                {"id": "aaa111aaa11", "title": "A"},
                {"id": "bbb222bbb22", "title": "B"},
                {"id": "ccc333ccc33", "title": "C"},
            ),
        }

    fake_ydl = MagicMock()
    fake_ydl.extract_info.side_effect = fake_extract
    fake_ydl.__enter__.return_value = fake_ydl
    fake_ydl.__exit__.return_value = False

    with patch("app.services.youtube_client.yt_dlp.YoutubeDL", return_value=fake_ydl):
        meta = client._fetch_with_ytdlp_flat("PLtest")

    assert len(meta.videos) == 3
    assert meta.title == "Grande"
