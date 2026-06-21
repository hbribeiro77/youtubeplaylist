import type { Video, VideoMoment } from '../api/client'

export interface PlaylistMomentItem {
  video: Video
  moment: VideoMoment
}

export function buildPlaylistMomentQueue(videos: Video[]): PlaylistMomentItem[] {
  return videos
    .flatMap((video) =>
      (video.moments ?? []).map((moment) => ({ video, moment })),
    )
    .sort((left, right) => {
      if (left.video.position !== right.video.position) {
        return left.video.position - right.video.position
      }
      return left.moment.position_seconds - right.moment.position_seconds
    })
}
