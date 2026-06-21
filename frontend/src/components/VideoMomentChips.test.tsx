import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { VideoMomentChips } from './VideoMomentChips'

const moments = [
  { id: 1, video_id: 10, position_seconds: 95, label: 'Golpe' },
  { id: 2, video_id: 10, position_seconds: 212, label: '' },
]

describe('VideoMomentChips', () => {
  it('renders clickable time labels', async () => {
    const user = userEvent.setup()
    const onPlayMoment = vi.fn()

    render(
      <VideoMomentChips moments={moments} isActive={false} onPlayMoment={onPlayMoment} />,
    )

    await user.click(screen.getByText('1:35 · Golpe'))
    expect(onPlayMoment).toHaveBeenCalledWith(moments[0])
    expect(screen.getByText('3:32')).toBeInTheDocument()
  })
})
