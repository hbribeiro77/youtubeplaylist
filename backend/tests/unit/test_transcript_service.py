from unittest.mock import MagicMock, patch

from app.db.models import TranscriptStatus
from app.services.transcript_service import fetch_transcript_text


def test_fetch_transcript_success(db_session, seed_playlist):
    video = seed_playlist["videos"][1]
    mock_fetched = MagicMock()
    mock_fetched.language_code = "pt"
    mock_fetched.__iter__ = MagicMock(return_value=iter([MagicMock(text="aula sobre python")]))

    mock_transcript = MagicMock()
    mock_transcript.fetch.return_value = mock_fetched

    mock_list = MagicMock()
    mock_list.find_transcript.return_value = mock_transcript

    mock_api = MagicMock()
    mock_api.list.return_value = mock_list

    with patch("app.services.transcript_service._get_transcript_api", return_value=mock_api):
        text = fetch_transcript_text(db_session, video)

    assert text == "aula sobre python"
    db_session.refresh(video)
    assert video.transcript_status == TranscriptStatus.ok
    assert video.transcript is not None


def test_fetch_transcript_unavailable(db_session, seed_playlist):
    video = seed_playlist["videos"][1]
    from youtube_transcript_api._errors import NoTranscriptFound

    mock_list = MagicMock()
    mock_list.find_transcript.side_effect = NoTranscriptFound("video", ["pt"], MagicMock())
    mock_list.find_generated_transcript.side_effect = NoTranscriptFound("video", ["pt"], MagicMock())

    mock_api = MagicMock()
    mock_api.list.return_value = mock_list

    with patch("app.services.transcript_service._get_transcript_api", return_value=mock_api):
        result = fetch_transcript_text(db_session, video)

    assert result is None
    db_session.refresh(video)
    assert video.transcript_status == TranscriptStatus.unavailable
