import { describe, expect, it } from 'vitest'
import type { Video } from '../api/client'
import { buildPlaylistMomentQueue } from './buildPlaylistMomentQueue'
import {
  addVideosToSelection,
  countMomentsForVideos,
  filterVideosWithMoments,
  getVideosInPlaylistOrder,
} from './playlistVideoSelection'

function makeVideo(id: number, position: number, moments: Video['moments']): Video {
  return {
    id,
    youtube_video_id: `vid-${id}`,
    playlist_id: 1,
    position,
    title: `Video ${id}`,
    description: '',
    duration_seconds: 300,
    thumbnail_url: 'https://example.com/thumb.jpg',
    tags: [],
    transcript_status: 'ok',
    replay_enabled: false,
    replay_duration_seconds: 5,
    loop_enabled: false,
    loop_count: 0,
    moments,
  }
}

describe('playlistVideoSelection', () => {
  const videos = [
    makeVideo(1, 0, []),
    makeVideo(2, 1, [{ id: 20, video_id: 2, position_seconds: 10, label: '' }]),
    makeVideo(3, 2, [{ id: 30, video_id: 3, position_seconds: 20, label: '' }]),
  ]

  it('filters videos that have moments', () => {
    expect(filterVideosWithMoments(videos)).toHaveLength(2)
  })

  it('keeps playlist order for selected videos', () => {
    const selected = getVideosInPlaylistOrder(videos, new Set([3, 1]))
    expect(selected.map((video) => video.id)).toEqual([1, 3])
  })

  it('builds moment queue only from selected videos', () => {
    const queue = buildPlaylistMomentQueue(videos, new Set([2]))
    expect(queue).toHaveLength(1)
    expect(queue[0].video.id).toBe(2)
  })

  it('counts moments for selected videos', () => {
    expect(countMomentsForVideos(videos, new Set([2, 3]))).toBe(2)
  })

  it('adds displayed videos to existing selection', () => {
    const next = addVideosToSelection(new Set([1]), [videos[1], videos[2]])
    expect([...next].sort()).toEqual([1, 2, 3])
  })
})
