import json
from unittest.mock import MagicMock

from app.services.sync_service import SyncService
from app.services.youtube_models import YtPlaylistMetadata, YtVideoMetadata


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
    assert playlist.playlist.title == "Minha Playlist"
    assert len(playlist.playlist.videos) == 1
    assert playlist.playlist.videos[0].duration_seconds == 180
    assert playlist.playlist.videos[0].is_new is True
    assert playlist.new_videos_added == 1
    assert json.loads(playlist.playlist.videos[0].tags_json) == ["tag1"]
