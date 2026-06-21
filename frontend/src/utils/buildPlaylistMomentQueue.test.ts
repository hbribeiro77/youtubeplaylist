import { describe, expect, it } from 'vitest'
import type { Video } from '../api/client'
import { buildPlaylistMomentQueue } from './buildPlaylistMomentQueue'

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
    moments,
  }
}

describe('buildPlaylistMomentQueue', () => {
  it('orders moments by video position then timestamp', () => {
    const videos = [
      makeVideo(2, 1, [{ id: 20, video_id: 2, position_seconds: 55, label: '' }]),
      makeVideo(1, 0, [
        { id: 11, video_id: 1, position_seconds: 12, label: '' },
        { id: 10, video_id: 1, position_seconds: 2, label: '' },
      ]),
      makeVideo(3, 2, [{ id: 30, video_id: 3, position_seconds: 34, label: '' }]),
    ]

    const queue = buildPlaylistMomentQueue(videos)

    expect(queue.map((item) => item.moment.id)).toEqual([10, 11, 20, 30])
  })
})
