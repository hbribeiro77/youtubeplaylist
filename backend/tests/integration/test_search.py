from app.services.search_service import search_videos


def test_fts_finds_term_in_transcript(db_session, seed_playlist):
    playlist_id = seed_playlist["playlist"].id
    results = search_videos(db_session, playlist_id, "kubernetes")
    assert len(results) == 1
    assert results[0].title == "Docker basics"


def test_fts_finds_term_in_title(db_session, seed_playlist):
    playlist_id = seed_playlist["playlist"].id
    results = search_videos(db_session, playlist_id, "Python")
    assert len(results) == 1
    assert results[0].youtube_video_id == "vid2"


def test_fts_finds_term_in_tags(db_session, seed_playlist):
    playlist_id = seed_playlist["playlist"].id
    results = search_videos(db_session, playlist_id, "git")
    assert len(results) == 1
    assert results[0].youtube_video_id == "vid3"


def test_list_without_query_returns_all_ordered(db_session, seed_playlist):
    playlist_id = seed_playlist["playlist"].id
    results = search_videos(db_session, playlist_id, None)
    assert len(results) == 3
    assert [v.position for v in results] == [0, 1, 2]
