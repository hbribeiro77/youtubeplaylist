import type { Video } from '../api/client'

export function filterVideosWithMoments(videos: Video[]): Video[] {
  return videos.filter((video) => (video.moments?.length ?? 0) > 0)
}

export function getVideosInPlaylistOrder(
  videos: Video[],
  selectedVideoIds: ReadonlySet<number>,
): Video[] {
  return videos.filter((video) => selectedVideoIds.has(video.id))
}

export function countMomentsForVideos(
  videos: Video[],
  selectedVideoIds?: ReadonlySet<number>,
): number {
  return videos
    .filter((video) => !selectedVideoIds || selectedVideoIds.has(video.id))
    .reduce((total, video) => total + (video.moments?.length ?? 0), 0)
}
