from sqlalchemy import text
from sqlalchemy.engine import Engine


def setup_fts(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE VIRTUAL TABLE IF NOT EXISTS videos_fts USING fts5(
                    video_id UNINDEXED,
                    playlist_id UNINDEXED,
                    title,
                    description,
                    tags,
                    transcript,
                    tokenize = 'unicode61'
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TRIGGER IF NOT EXISTS videos_fts_ai AFTER INSERT ON videos BEGIN
                    INSERT INTO videos_fts(video_id, playlist_id, title, description, tags, transcript)
                    VALUES (new.id, new.playlist_id, new.title, new.description, new.tags_json, '');
                END
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TRIGGER IF NOT EXISTS videos_fts_au AFTER UPDATE ON videos BEGIN
                    UPDATE videos_fts SET
                        title = new.title,
                        description = new.description,
                        tags = new.tags_json
                    WHERE video_id = new.id;
                END
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TRIGGER IF NOT EXISTS videos_fts_ad AFTER DELETE ON videos BEGIN
                    DELETE FROM videos_fts WHERE video_id = old.id;
                END
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TRIGGER IF NOT EXISTS transcripts_fts_au AFTER INSERT ON transcripts BEGIN
                    UPDATE videos_fts SET transcript = new.text WHERE video_id = new.video_id;
                END
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TRIGGER IF NOT EXISTS transcripts_fts_update AFTER UPDATE ON transcripts BEGIN
                    UPDATE videos_fts SET transcript = new.text WHERE video_id = new.video_id;
                END
                """
            )
        )


def rebuild_fts_for_video(conn, video_id: int, title: str, description: str, tags: str, transcript: str, playlist_id: int) -> None:
    conn.execute(text("DELETE FROM videos_fts WHERE video_id = :video_id"), {"video_id": video_id})
    conn.execute(
        text(
            """
            INSERT INTO videos_fts(video_id, playlist_id, title, description, tags, transcript)
            VALUES (:video_id, :playlist_id, :title, :description, :tags, :transcript)
            """
        ),
        {
            "video_id": video_id,
            "playlist_id": playlist_id,
            "title": title,
            "description": description,
            "tags": tags,
            "transcript": transcript,
        },
    )
