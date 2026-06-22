import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Playlist } from '../api/client'
import { PlaylistLibraryCard } from './PlaylistLibraryCard'

interface PlaylistHomeProps {
  onOpenPlaylist: (playlist: Playlist) => void
}

export function PlaylistHome({ onOpenPlaylist }: PlaylistHomeProps) {
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncingPlaylistId, setSyncingPlaylistId] = useState<number | null>(null)
  const [syncMessages, setSyncMessages] = useState<Record<number, string>>({})
  const [clearingNews, setClearingNews] = useState(false)
  const queryClient = useQueryClient()

  const { data: playlists = [], isLoading, error } = useQuery({
    queryKey: ['playlists'],
    queryFn: api.listPlaylists,
  })

  const totalNewVideos = playlists.reduce((sum, playlist) => sum + playlist.new_video_count, 0)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    setLoading(true)
    try {
      const result = await api.createPlaylist(playlistUrl)
      await queryClient.invalidateQueries({ queryKey: ['playlists'] })
      setPlaylistUrl('')
      onOpenPlaylist(result)
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async (playlist: Playlist) => {
    setSyncingPlaylistId(playlist.id)
    try {
      const result = await api.syncPlaylist(playlist.id)
      await queryClient.invalidateQueries({ queryKey: ['playlists'] })

      const message =
        result.new_videos_added > 0
          ? `+${result.new_videos_added} novidade${result.new_videos_added === 1 ? '' : 's'} neste sync`
          : 'Nenhuma novidade neste sync'

      setSyncMessages((current) => ({ ...current, [playlist.id]: message }))
    } catch (err) {
      setSyncMessages((current) => ({
        ...current,
        [playlist.id]: (err as Error).message,
      }))
    } finally {
      setSyncingPlaylistId(null)
    }
  }

  const handleClearAllNew = async () => {
    setClearingNews(true)
    try {
      await api.acknowledgeAllNewVideos()
      await queryClient.invalidateQueries({ queryKey: ['playlists'] })
      await queryClient.invalidateQueries({ queryKey: ['videos'] })
    } finally {
      setClearingNews(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-6" data-testid="playlist-home">
      <div>
        <h1 className="text-2xl font-bold">YouTube Playlist</h1>
        <p className="mt-2 text-sm text-slate-400">
          Abra uma playlist salva, sincronize novidades ou adicione uma nova pelo link do YouTube.
        </p>
      </div>

      {totalNewVideos > 0 && (
        <section
          className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3"
          data-testid="global-new-videos-banner"
        >
          <p className="flex-1 text-sm text-emerald-200">
            <span className="font-semibold text-emerald-100">{totalNewVideos}</span>{' '}
            novidade{totalNewVideos === 1 ? '' : 's'} em {playlists.filter((p) => p.new_video_count > 0).length}{' '}
            playlist{playlists.filter((p) => p.new_video_count > 0).length === 1 ? '' : 's'}
          </p>
          <button
            type="button"
            data-testid="clear-all-new-videos"
            onClick={handleClearAllNew}
            disabled={clearingNews}
            className="rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-3 py-2 text-sm font-medium text-emerald-100 disabled:opacity-60"
          >
            {clearingNews ? 'Limpando...' : 'Limpar novidades'}
          </button>
        </section>
      )}

      {playlists.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Playlists salvas
          </h2>
          {isLoading && <p className="text-sm text-slate-400">Carregando playlists...</p>}
          {error && <p className="text-sm text-red-400">{(error as Error).message}</p>}
          <div className="flex flex-col gap-3">
            {playlists.map((playlist) => (
              <PlaylistLibraryCard
                key={playlist.id}
                playlist={playlist}
                syncing={syncingPlaylistId === playlist.id}
                lastSyncMessage={syncMessages[playlist.id] ?? null}
                onSelect={onOpenPlaylist}
                onSync={handleSync}
              />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          {playlists.length > 0 ? 'Adicionar playlist' : 'Nova playlist'}
        </h2>
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
            {loading ? 'Sincronizando...' : 'Adicionar playlist'}
          </button>
          {formError && <p className="text-sm text-red-400">{formError}</p>}
        </form>
      </section>
    </div>
  )
}
