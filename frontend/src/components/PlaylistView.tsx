import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Playlist, type Video } from '../api/client'
import { PlaylistHome } from './PlaylistHome'
import { SearchBar } from './SearchBar'
import { VideoCard } from './VideoCard'
import { VideoPlayer } from './VideoPlayer'

interface PlaylistViewProps {
  playlist: Playlist
  onBack: () => void
}

export function PlaylistView({ playlist, onBack }: PlaylistViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const queryClient = useQueryClient()

  const { data: videos = [], isLoading, error } = useQuery({
    queryKey: ['videos', playlist.id, searchQuery],
    queryFn: () => api.listVideos(playlist.id, searchQuery || undefined),
  })

  useEffect(() => {
    if (!activeVideoId && videos.length > 0) {
      const firstId = videos[0].youtube_video_id?.trim()
      if (firstId) setActiveVideoId(firstId)
    }
  }, [videos, activeVideoId])

  useEffect(() => {
    if (!activeVideoId) return
    const element = cardRefs.current[activeVideoId]
    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeVideoId])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleSelect = (video: Video) => {
    const id = video.youtube_video_id?.trim()
    if (id) setActiveVideoId(id)
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await api.syncPlaylist(playlist.id)
      await queryClient.invalidateQueries({ queryKey: ['videos', playlist.id] })
      await queryClient.invalidateQueries({ queryKey: ['playlists'] })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <header className="flex items-center gap-2 border-b border-slate-800 px-3 py-3">
        <button
          type="button"
          data-testid="back-to-playlists"
          onClick={onBack}
          className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200"
        >
          ← Playlists
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold">{playlist.title}</h1>
        <button
          type="button"
          data-testid="sync-playlist"
          onClick={handleSync}
          disabled={syncing}
          className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 disabled:opacity-60"
        >
          {syncing ? '...' : 'Sync'}
        </button>
      </header>

      <VideoPlayer videoId={activeVideoId} onVideoChange={setActiveVideoId} />
      <SearchBar onSearch={handleSearch} />

      <div className="flex flex-col gap-3 px-3 pb-8" data-testid="video-list">
        {isLoading && <p className="px-2 text-sm text-slate-400">Carregando vídeos...</p>}
        {error && <p className="px-2 text-sm text-red-400">{(error as Error).message}</p>}
        {!isLoading && videos.length === 0 && (
          <p className="px-2 text-sm text-slate-400">Nenhum vídeo encontrado.</p>
        )}
        {videos.map((video) => (
          <div
            key={video.id}
            ref={(el) => {
              cardRefs.current[video.youtube_video_id] = el?.querySelector('button') ?? null
            }}
          >
            <VideoCard
              video={video}
              isActive={video.youtube_video_id === activeVideoId}
              searchQuery={searchQuery}
              onSelect={handleSelect}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PlaylistApp() {
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null)

  if (selectedPlaylist) {
    return (
      <PlaylistView
        playlist={selectedPlaylist}
        onBack={() => setSelectedPlaylist(null)}
      />
    )
  }

  return <PlaylistHome onOpenPlaylist={setSelectedPlaylist} />
}
