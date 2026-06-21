import json

import httpx
import pytest

from app.services.innertube_playlist_client import (
    InnertubePlaylistClient,
    extract_lockups_from_browse,
    find_continuation_token,
    parse_duration_text,
    parse_lockup,
)
from app.services.youtube_client import YouTubeClient


LOCKUP_SAMPLE = {
    "contentId": "dQw4w9WgXcQ",
    "contentImage": {
        "thumbnailViewModel": {
            "image": {
                "sources": [
                    {"url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"},
                ]
            },
            "overlays": [
                {
                    "thumbnailBottomOverlayViewModel": {
                        "badges": [
                            {"thumbnailBadgeViewModel": {"text": "3:32"}},
                        ]
                    }
                }
            ],
        }
    },
    "metadata": {
        "lockupMetadataViewModel": {
            "title": {"content": "Never Gonna Give You Up"},
        }
    },
}


def test_parse_duration_text():
    assert parse_duration_text("3:32") == 212
    assert parse_duration_text("1:02:03") == 3723
    assert parse_duration_text("") == 0


def test_parse_lockup_extracts_video_metadata():
    video = parse_lockup(LOCKUP_SAMPLE)
    assert video is not None
    assert video.youtube_video_id == "dQw4w9WgXcQ"
    assert video.title == "Never Gonna Give You Up"
    assert video.duration_seconds == 212


def test_find_continuation_token_from_view_model():
    payload = {
        "continuationItemViewModel": {
            "continuationCommand": {
                "innertubeCommand": {
                    "continuationCommand": {"token": "abc123"},
                }
            }
        }
    }
    assert find_continuation_token(payload) == "abc123"


def test_extract_lockups_from_browse():
    payload = {"section": {"lockupViewModel": LOCKUP_SAMPLE}}
    videos = extract_lockups_from_browse(payload)
    assert len(videos) == 1
    assert videos[0].youtube_video_id == "dQw4w9WgXcQ"


@pytest.mark.live
def test_live_intergender_playlist_loads_hundreds_of_videos():
    playlist_id = "PL5ICdVajip1jU92Gxk2y12L8spqQ1f2Df"
    metadata = YouTubeClient().fetch_playlist(playlist_id)

    assert metadata.title
    assert len(metadata.videos) >= 700
    assert metadata.playlist_count is None or len(metadata.videos) >= int(metadata.playlist_count * 0.85)
