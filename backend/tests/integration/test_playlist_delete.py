def test_delete_playlist_removes_from_list(client, seed_playlist):
    playlist = seed_playlist["playlist"]
    response = client.delete(f"/playlists/{playlist.id}")
    assert response.status_code == 204

    listed = client.get("/playlists").json()
    assert all(entry["id"] != playlist.id for entry in listed)


def test_delete_playlist_not_found(client):
    response = client.delete("/playlists/99999")
    assert response.status_code == 404
