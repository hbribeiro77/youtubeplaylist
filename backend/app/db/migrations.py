from sqlalchemy import text

REPLAY_DURATION_OPTIONS = (5, 8, 10)
DEFAULT_REPLAY_DURATION_SECONDS = 5


def run_sqlite_migrations(engine) -> None:
    if engine.dialect.name != "sqlite":
        return

    with engine.begin() as connection:
        columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(videos)")).fetchall()
        }

        if "replay_enabled" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE videos "
                    "ADD COLUMN replay_enabled BOOLEAN NOT NULL DEFAULT 0"
                )
            )

        if "replay_duration_seconds" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE videos "
                    f"ADD COLUMN replay_duration_seconds INTEGER NOT NULL DEFAULT {DEFAULT_REPLAY_DURATION_SECONDS}"
                )
            )

        if "loop_enabled" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE videos "
                    "ADD COLUMN loop_enabled BOOLEAN NOT NULL DEFAULT 0"
                )
            )
