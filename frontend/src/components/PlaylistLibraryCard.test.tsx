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
  new_video_count: 3,
}

describe('PlaylistLibraryCard', () => {
  it('renders title, video count and new badge', () => {
    render(
      <PlaylistLibraryCard playlist={samplePlaylist} onSelect={vi.fn()} onSync={vi.fn()} />,
    )
    expect(screen.getByText('Minha Playlist')).toBeInTheDocument()
    expect(screen.getByText('12 vídeos')).toBeInTheDocument()
    expect(screen.getByText('Padrão')).toBeInTheDocument()
    expect(screen.getByTestId('playlist-new-count')).toHaveTextContent('3 novidades')
  })

  it('calls onSelect when main area is clicked', async () => {
    const onSelect = vi.fn()
    render(
      <PlaylistLibraryCard playlist={samplePlaylist} onSelect={onSelect} onSync={vi.fn()} />,
    )
    await userEvent.click(screen.getByText('Minha Playlist'))
    expect(onSelect).toHaveBeenCalledWith(samplePlaylist)
  })

  it('calls onSync from sync button', async () => {
    const onSync = vi.fn()
    render(
      <PlaylistLibraryCard playlist={samplePlaylist} onSelect={vi.fn()} onSync={onSync} />,
    )
    await userEvent.click(screen.getByTestId('playlist-sync-button'))
    expect(onSync).toHaveBeenCalledWith(samplePlaylist)
  })
})
