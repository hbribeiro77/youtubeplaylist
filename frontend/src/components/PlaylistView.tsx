import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type Playlist, type Video } from '../api/client'
import { SearchBar } from './SearchBar'
import { VideoCard } from './VideoCard'
import { VideoPlayer } from './VideoPlayer'

interface PlaylistViewProps {
  playlistId: number
  playlistTitle?: string
}

export function PlaylistView({ playlistId, playlistTitle }: PlaylistViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const { data: videos = [], isLoading, error } = useQuery({
    queryKey: ['videos', playlistId, searchQuery],
    queryFn: () => api.listVideos(playlistId, searchQuery || undefined),
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

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <header className="border-b border-slate-800 px-4 py-3">
        <h1 className="text-lg font-bold">{playlistTitle ?? 'YouTube Playlist'}</h1>
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

interface AppShellProps {
  initialPlaylist?: Playlist | null
}

export function PlaylistApp({ initialPlaylist = null }: AppShellProps) {
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(initialPlaylist)
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists'],
    queryFn: api.listPlaylists,
  })

  useEffect(() => {
    if (!selectedPlaylist && playlists.length > 0) {
      const defaultPlaylist = playlists.find((p) => p.is_default) ?? playlists[0]
      setSelectedPlaylist(defaultPlaylist)
    }
  }, [playlists, selectedPlaylist])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    setLoading(true)
    try {
      const playlist = await api.createPlaylist(playlistUrl)
      setSelectedPlaylist(playlist)
      setPlaylistUrl('')
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (selectedPlaylist) {
    return <PlaylistView playlistId={selectedPlaylist.id} playlistTitle={selectedPlaylist.title} />
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-bold">YouTube Playlist</h1>
        <p className="mt-2 text-sm text-slate-400">
          Cole a URL de uma playlist pública para assistir e pesquisar vídeos no celular.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="url"
          data-testid="playlist-url-input"
          value={playlistUrl}
          onChange={(e) => setPlaylistUrl(e.target.value)}
          placeholder="https://www.youtube.com/playlist?list=..."
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-yellow-400 px-4 py-3 font-semibold text-slate-900 disabled:opacity-60"
        >
          {loading ? 'Carregando...' : 'Carregar playlist'}
        </button>
        {formError && <p className="text-sm text-red-400">{formError}</p>}
      </form>
    </div>
  )
}
