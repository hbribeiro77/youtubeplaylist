import json
from unittest.mock import MagicMock

from app.services.sync_service import SyncService
from app.services.youtube_client import YtPlaylistMetadata, YtVideoMetadata


def test_sync_playlist_persists_videos(db_session):
    playlist_id = "PLtest123"
    metadata = YtPlaylistMetadata(
        title="Minha Playlist",
        videos=[
            YtVideoMetadata(
                youtube_video_id="video1",
                title="Video 1",
                description="Desc",
                duration_seconds=180,
                thumbnail_url="https://img/1.jpg",
                tags=["tag1"],
            )
        ],
    )

    service = SyncService(youtube_client=MagicMock())
    service.youtube.fetch_playlist = MagicMock(return_value=metadata)

    playlist = service.sync_playlist(db_session, playlist_id)
    assert playlist.title == "Minha Playlist"
    assert len(playlist.videos) == 1
    assert playlist.videos[0].duration_seconds == 180
    assert json.loads(playlist.videos[0].tags_json) == ["tag1"]
