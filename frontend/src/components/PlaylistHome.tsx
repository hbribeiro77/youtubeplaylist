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
  const queryClient = useQueryClient()

  const { data: playlists = [], isLoading, error } = useQuery({
    queryKey: ['playlists'],
    queryFn: api.listPlaylists,
  })

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    setLoading(true)
    try {
      const playlist = await api.createPlaylist(playlistUrl)
      await queryClient.invalidateQueries({ queryKey: ['playlists'] })
      setPlaylistUrl('')
      onOpenPlaylist(playlist)
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-6" data-testid="playlist-home">
      <div>
        <h1 className="text-2xl font-bold">YouTube Playlist</h1>
        <p className="mt-2 text-sm text-slate-400">
          Abra uma playlist salva ou adicione uma nova pelo link do YouTube.
        </p>
      </div>

      {playlists.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Playlists salvas
          </h2>
          {isLoading && <p className="text-sm text-slate-400">Carregando playlists...</p>}
          {error && <p className="text-sm text-red-400">{(error as Error).message}</p>}
          <div className="flex flex-col gap-3">
            {playlists.map((playlist) => (
              <PlaylistLibraryCard key={playlist.id} playlist={playlist} onSelect={onOpenPlaylist} />
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
