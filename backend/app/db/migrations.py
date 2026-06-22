from sqlalchemy import text

REPLAY_DURATION_OPTIONS = tuple(range(5, 35, 5))
DEFAULT_REPLAY_DURATION_SECONDS = 5
LOOP_COUNT_OPTIONS = (0, 1, 2, 3, 4, 5, -1)
DEFAULT_LOOP_COUNT = 0
INFINITE_LOOP_COUNT = -1


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

        if "loop_count" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE videos "
                    f"ADD COLUMN loop_count INTEGER NOT NULL DEFAULT {DEFAULT_LOOP_COUNT}"
                )
            )
            connection.execute(
                text(
                    "UPDATE videos SET loop_count = :infinite WHERE loop_enabled = 1"
                ),
                {"infinite": INFINITE_LOOP_COUNT},
            )

        connection.execute(
            text(
                "UPDATE videos SET replay_duration_seconds = 10 "
                "WHERE replay_duration_seconds = 8"
            )
        )

        if "is_new" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE videos "
                    "ADD COLUMN is_new BOOLEAN NOT NULL DEFAULT 0"
                )
            )

        if "published_at" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE videos "
                    "ADD COLUMN published_at DATETIME"
                )
            )
