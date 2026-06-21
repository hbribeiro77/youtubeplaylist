import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Playlist } from '../api/client'
import { PlaylistLibraryCard } from './PlaylistLibraryCard'

const samplePlaylist: Playlist = {
  id: 1,
  youtube_playlist_id: 'PLtest',
  title: 'Minha Playlist',
  is_default: true,
  last_synced_at: '2026-06-20T12:00:00',
  video_count: 12,
}

describe('PlaylistLibraryCard', () => {
  it('renders title and video count', () => {
    render(<PlaylistLibraryCard playlist={samplePlaylist} onSelect={vi.fn()} />)
    expect(screen.getByText('Minha Playlist')).toBeInTheDocument()
    expect(screen.getByText('12 vídeos')).toBeInTheDocument()
    expect(screen.getByText('Padrão')).toBeInTheDocument()
  })

  it('calls onSelect when clicked', async () => {
    const onSelect = vi.fn()
    render(<PlaylistLibraryCard playlist={samplePlaylist} onSelect={onSelect} />)
    await userEvent.click(screen.getByTestId('playlist-library-card'))
    expect(onSelect).toHaveBeenCalledWith(samplePlaylist)
  })
})
