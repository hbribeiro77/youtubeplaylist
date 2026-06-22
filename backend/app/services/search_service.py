from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.models import Video


def build_fts_query(search_term: str) -> str:
    cleaned = search_term.strip()
    if not cleaned:
        return ""
    tokens = [token for token in cleaned.split() if token]
    return " ".join(f'"{token}"' for token in tokens)


def search_videos(db: Session, playlist_id: int, query: str | None = None) -> list[Video]:
    if query and query.strip():
        fts_query = build_fts_query(query)
        rows = db.execute(
            text(
                """
                SELECT video_id FROM videos_fts
                WHERE playlist_id = :playlist_id AND videos_fts MATCH :query
                ORDER BY rank
                """
            ),
            {"playlist_id": playlist_id, "query": fts_query},
        ).fetchall()
        video_ids = [row[0] for row in rows]
        if not video_ids:
            return []
        videos = db.query(Video).filter(Video.id.in_(video_ids)).all()
        order = {vid: idx for idx, vid in enumerate(video_ids)}
        return sorted(videos, key=lambda v: (-int(v.is_new), order.get(v.id, 9999)))

    return (
        db.query(Video)
        .filter(Video.playlist_id == playlist_id)
        .order_by(Video.is_new.desc(), Video.position.asc())
        .all()
    )
