import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  replay_enabled: false,
  replay_duration_seconds: 5,
  loop_enabled: false,
  loop_count: 0,
  is_new: false,
}

const baseProps = {
  onSelect: vi.fn(),
  onSelectedChange: vi.fn(),
  onPlayMoment: vi.fn(),
  onReplayChange: vi.fn(),
  onLoopCountChange: vi.fn(),
  onReplayDurationChange: vi.fn(),
}

describe('VideoCard', () => {
  it('renders thumbnail, title, duration and playlist number', () => {
    render(
      <VideoCard
        video={sampleVideo}
        isActive={false}
        isSelected={false}
        {...baseProps}
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
        isSelected={false}
        {...baseProps}
      />,
    )
    expect(screen.getByTestId('video-card-active')).toHaveClass('ring-yellow-400')
  })

  it('shows selection checkbox and calls handler', async () => {
    const user = userEvent.setup()
    const onSelectedChange = vi.fn()

    render(
      <VideoCard
        video={sampleVideo}
        isActive={false}
        isSelected={false}
        {...baseProps}
        onSelectedChange={onSelectedChange}
      />,
    )

    await user.click(screen.getByTestId('video-select-checkbox'))
    expect(onSelectedChange).toHaveBeenCalledWith(sampleVideo, true)
  })

  it('shows replay duration and loop selectors when replay is enabled', () => {
    render(
      <VideoCard
        video={{ ...sampleVideo, replay_enabled: true, replay_duration_seconds: 15, loop_count: 3 }}
        isActive={false}
        isSelected
        {...baseProps}
      />,
    )
    expect(screen.getByTestId('replay-checkbox')).toBeChecked()
    expect(screen.getByTestId('replay-duration-select')).toHaveValue('15')
    expect(screen.getByTestId('loop-count-select')).toHaveValue('3')
    expect(screen.getByTestId('video-select-checkbox')).toBeChecked()
  })

  it('shows novidade badge when video is new', () => {
    render(
      <VideoCard
        video={{ ...sampleVideo, is_new: true }}
        isActive={false}
        isSelected={false}
        {...baseProps}
      />,
    )
    expect(screen.getByTestId('video-new-badge')).toHaveTextContent('Novidade')
  })
})
