from unittest.mock import MagicMock

from app.db.models import Video
from app.services.sync_service import SyncService
from app.services.youtube_models import YtPlaylistMetadata, YtVideoMetadata
from app.services.search_service import search_videos


def test_sync_marks_new_videos_and_lists_them_first(db_session):
    playlist_id = "PLnewvideos"
    service = SyncService(youtube_client=MagicMock())

    first_sync = YtPlaylistMetadata(
        title="Playlist",
        videos=[
            YtVideoMetadata(
                youtube_video_id="video-old",
                title="Antigo",
                description="",
                duration_seconds=100,
                thumbnail_url="https://img/old.jpg",
                tags=[],
            )
        ],
    )
    service.youtube.fetch_playlist = MagicMock(return_value=first_sync)
    result = service.sync_playlist(db_session, playlist_id)
    assert result.new_videos_added == 1

    old_video = db_session.query(Video).filter_by(youtube_video_id="video-old").one()
    old_video.is_new = False
    db_session.commit()

    second_sync = YtPlaylistMetadata(
        title="Playlist",
        videos=[
            YtVideoMetadata(
                youtube_video_id="video-new",
                title="Novo",
                description="",
                duration_seconds=120,
                thumbnail_url="https://img/new.jpg",
                tags=[],
            ),
            YtVideoMetadata(
                youtube_video_id="video-old",
                title="Antigo",
                description="",
                duration_seconds=100,
                thumbnail_url="https://img/old.jpg",
                tags=[],
            ),
        ],
    )
    service.youtube.fetch_playlist = MagicMock(return_value=second_sync)
    result = service.sync_playlist(db_session, playlist_id)
    assert result.new_videos_added == 1

    videos = search_videos(db_session, result.playlist.id)
    assert videos[0].youtube_video_id == "video-new"
    assert videos[0].is_new is True
    assert videos[1].youtube_video_id == "video-old"
    assert videos[1].is_new is False


def test_playlist_list_includes_new_video_count(client, seed_playlist):
    playlist = seed_playlist["playlist"]
    response = client.get("/playlists")
    assert response.status_code == 200
    item = next(entry for entry in response.json() if entry["id"] == playlist.id)
    assert "new_video_count" in item


def test_acknowledge_all_new_clears_flags(client, seed_playlist, db_session):
    from app.db.models import Video

    for video in seed_playlist["videos"]:
        video.is_new = True
    db_session.commit()

    response = client.post("/playlists/acknowledge-all-new")
    assert response.status_code == 200
    assert response.json()["cleared_count"] == 3

    remaining = db_session.query(Video).filter(Video.is_new.is_(True)).count()
    assert remaining == 0
