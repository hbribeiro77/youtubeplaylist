import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VideoCard } from '../components/VideoCard'
import type { Video } from '../api/client'

const sampleVideo: Video = {
  id: 1,
  youtube_video_id: 'abc123',
  playlist_id: 1,
  position: 0,
  title: 'Docker basics',
  description: 'Intro containers',
  duration_seconds: 212,
  thumbnail_url: 'https://example.com/thumb.jpg',
  tags: ['docker'],
  transcript_status: 'ok',
  moments: [],
}

describe('VideoCard', () => {
  it('renders thumbnail, title, duration and playlist number', () => {
    render(
      <VideoCard
        video={sampleVideo}
        isActive={false}
        onSelect={vi.fn()}
        onPlayMoment={vi.fn()}
      />,
    )
    expect(screen.getByText('Docker basics')).toBeInTheDocument()
    expect(screen.getByText('3:32')).toBeInTheDocument()
    expect(screen.getByLabelText('Vídeo 1')).toHaveTextContent('1')
    expect(screen.getByAltText('Docker basics')).toBeInTheDocument()
  })

  it('applies active highlight styles', () => {
    render(
      <VideoCard
        video={sampleVideo}
        isActive
        onSelect={vi.fn()}
        onPlayMoment={vi.fn()}
      />,
    )
    expect(screen.getByTestId('video-card-active')).toHaveClass('ring-yellow-400')
  })
})
