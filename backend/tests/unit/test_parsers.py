import pytest

from app.schemas.playlist import parse_playlist_id
from app.services.search_service import build_fts_query


@pytest.mark.parametrize(
    "value,expected",
    [
        ("PLrAXtmRdnEQy6nuLMH8k", "PLrAXtmRdnEQy6nuLMH8k"),
        ("https://www.youtube.com/playlist?list=PLabc123", "PLabc123"),
        ("https://youtube.com/watch?v=xyz&list=PLxyz789", "PLxyz789"),
    ],
)
def test_parse_playlist_id(value, expected):
    assert parse_playlist_id(value) == expected


def test_parse_playlist_id_invalid():
    with pytest.raises(ValueError):
        parse_playlist_id("not-a-valid-playlist")


def test_build_fts_query():
    assert build_fts_query("kubernetes docker") == '"kubernetes" "docker"'
