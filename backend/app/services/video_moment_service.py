from sqlalchemy.orm import Session, joinedload

from app.db.models import Video, VideoMoment


def get_video_or_none(db: Session, video_id: int) -> Video | None:
    return db.query(Video).filter(Video.id == video_id).first()


def list_videos_with_moments(db: Session, video_ids: list[int]) -> dict[int, list[VideoMoment]]:
    if not video_ids:
        return {}
    videos = (
        db.query(Video)
        .options(joinedload(Video.moments))
        .filter(Video.id.in_(video_ids))
        .all()
    )
    return {video.id: list(video.moments) for video in videos}


def create_moment(
    db: Session,
    video: Video,
    position_seconds: int,
    label: str = "",
) -> VideoMoment:
    existing = (
        db.query(VideoMoment)
        .filter(
            VideoMoment.video_id == video.id,
            VideoMoment.position_seconds == position_seconds,
        )
        .first()
    )
    if existing:
        if label and not existing.label:
            existing.label = label
            db.commit()
            db.refresh(existing)
        return existing

    moment = VideoMoment(
        video_id=video.id,
        position_seconds=position_seconds,
        label=label.strip(),
    )
    db.add(moment)
    db.commit()
    db.refresh(moment)
    return moment


def delete_moment(db: Session, video: Video, moment_id: int) -> bool:
    moment = (
        db.query(VideoMoment)
        .filter(VideoMoment.id == moment_id, VideoMoment.video_id == video.id)
        .first()
    )
    if moment is None:
        return False
    db.delete(moment)
    db.commit()
    return True
