def test_create_and_list_video_moments(client, seed_playlist):
    video = seed_playlist["videos"][0]
    playlist_id = seed_playlist["playlist"].id

    response = client.post(
        f"/videos/{video.id}/moments",
        json={"position_seconds": 95, "label": "Golpe principal"},
    )
    assert response.status_code == 200
    moment = response.json()
    assert moment["position_seconds"] == 95
    assert moment["label"] == "Golpe principal"

    listed = client.get(f"/playlists/{playlist_id}/videos")
    assert listed.status_code == 200
    first = next(item for item in listed.json() if item["id"] == video.id)
    assert len(first["moments"]) == 1
    assert first["moments"][0]["position_seconds"] == 95


def test_create_moment_is_idempotent_for_same_second(client, seed_playlist):
    video = seed_playlist["videos"][0]

    first = client.post(f"/videos/{video.id}/moments", json={"position_seconds": 42})
    second = client.post(f"/videos/{video.id}/moments", json={"position_seconds": 42, "label": "Replay"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert second.json()["label"] == "Replay"


def test_delete_video_moment(client, seed_playlist):
    video = seed_playlist["videos"][0]
    playlist_id = seed_playlist["playlist"].id

    created = client.post(f"/videos/{video.id}/moments", json={"position_seconds": 10})
    moment_id = created.json()["id"]

    deleted = client.delete(f"/videos/{video.id}/moments/{moment_id}")
    assert deleted.status_code == 204

    listed = client.get(f"/playlists/{playlist_id}/videos").json()
    first = next(item for item in listed if item["id"] == video.id)
    assert first["moments"] == []


def test_create_moment_rejects_unknown_video(client):
    response = client.post("/videos/99999/moments", json={"position_seconds": 1})
    assert response.status_code == 404
