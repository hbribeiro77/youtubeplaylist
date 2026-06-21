def test_update_video_replay_settings(client, seed_playlist):
    video = seed_playlist["videos"][0]
    playlist_id = seed_playlist["playlist"].id

    response = client.patch(
        f"/videos/{video.id}/replay",
        json={"replay_enabled": True, "replay_duration_seconds": 15},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["replay_enabled"] is True
    assert data["replay_duration_seconds"] == 15

    listed = client.get(f"/playlists/{playlist_id}/videos").json()
    first = next(item for item in listed if item["id"] == video.id)
    assert first["replay_enabled"] is True
    assert first["replay_duration_seconds"] == 15

    other = next(item for item in listed if item["id"] != video.id)
    assert other["replay_enabled"] is False
    assert other["replay_duration_seconds"] == 5


def test_update_video_loop_count(client, seed_playlist):
    video = seed_playlist["videos"][0]

    response = client.patch(
        f"/videos/{video.id}/replay",
        json={"loop_count": 3},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["loop_count"] == 3
    assert data["loop_enabled"] is True

    infinite = client.patch(
        f"/videos/{video.id}/replay",
        json={"loop_count": -1},
    )
    assert infinite.status_code == 200
    assert infinite.json()["loop_count"] == -1


def test_update_replay_rejects_invalid_duration(client, seed_playlist):
    video = seed_playlist["videos"][0]
    response = client.patch(
        f"/videos/{video.id}/replay",
        json={"replay_duration_seconds": 7},
    )
    assert response.status_code == 400


def test_update_replay_rejects_invalid_loop_count(client, seed_playlist):
    video = seed_playlist["videos"][0]
    response = client.patch(
        f"/videos/{video.id}/replay",
        json={"loop_count": 6},
    )
    assert response.status_code == 400
