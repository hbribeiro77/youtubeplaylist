def test_seed_playlist_videos_not_empty(client, seed_playlist):
    playlist_id = seed_playlist["playlist"].id
    response = client.get(f"/playlists/{playlist_id}/videos")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3


def test_seed_playlist_search_filters(client, seed_playlist):
    playlist_id = seed_playlist["playlist"].id
    term = seed_playlist["search_term"]
    response = client.get(f"/playlists/{playlist_id}/videos", params={"q": term})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["youtube_video_id"] == "vid1"
