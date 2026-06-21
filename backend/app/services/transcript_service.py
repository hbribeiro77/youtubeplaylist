from sqlalchemy.orm import Session
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled

from app.db.fts import rebuild_fts_for_video
from app.db.models import Transcript, TranscriptStatus, Video


def _get_transcript_api() -> YouTubeTranscriptApi:
    return YouTubeTranscriptApi()


def fetch_transcript_text(db: Session, video: Video, languages: list[str] | None = None) -> str | None:
    langs = languages or ["pt", "pt-BR", "en"]
    try:
        api = _get_transcript_api()
        transcript_list = api.list(video.youtube_video_id)
        transcript = None
        for lang in langs:
            try:
                transcript = transcript_list.find_transcript([lang])
                break
            except NoTranscriptFound:
                continue
        if transcript is None:
            try:
                transcript = transcript_list.find_generated_transcript(langs)
            except NoTranscriptFound:
                video.transcript_status = TranscriptStatus.unavailable
                db.commit()
                return None

        fetched = transcript.fetch()
        text = " ".join(snippet.text for snippet in fetched).strip()
        if not text:
            video.transcript_status = TranscriptStatus.unavailable
            db.commit()
            return None

        if video.transcript is None:
            video.transcript = Transcript(
                video_id=video.id,
                language=fetched.language_code,
                text=text,
            )
            db.add(video.transcript)
        else:
            video.transcript.text = text
            video.transcript.language = fetched.language_code

        video.transcript_status = TranscriptStatus.ok
        db.flush()
        rebuild_fts_for_video(
            db.connection(),
            video.id,
            video.title,
            video.description,
            video.tags_json,
            text,
            video.playlist_id,
        )
        db.commit()
        return text
    except (NoTranscriptFound, TranscriptsDisabled):
        video.transcript_status = TranscriptStatus.unavailable
        db.commit()
        return None
