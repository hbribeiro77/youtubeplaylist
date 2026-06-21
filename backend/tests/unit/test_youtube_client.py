import pytest

from app.services.youtube_client import normalize_video_id, parse_ytdlp_entries


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
