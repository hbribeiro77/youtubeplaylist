import pytest

from app.services.youtube_client import merge_video_lists, normalize_video_id, parse_ytdlp_entries, YtVideoMetadata


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
