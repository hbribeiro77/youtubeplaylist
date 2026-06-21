import type { Playlist } from '../api/client'

interface PlaylistLibraryCardProps {
  playlist: Playlist
  onSelect: (playlist: Playlist) => void
}

function formatSyncedAt(value: string | null): string {
  if (!value) return 'Nunca sincronizada'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sincronizada'
  return `Atualizada em ${date.toLocaleDateString('pt-BR')}`
}

export function PlaylistLibraryCard({ playlist, onSelect }: PlaylistLibraryCardProps) {
  return (
    <button
      type="button"
      data-testid="playlist-library-card"
      onClick={() => onSelect(playlist)}
      className="flex w-full flex-col gap-2 rounded-xl border border-slate-700 bg-slate-900 p-4 text-left transition hover:border-yellow-400 hover:bg-slate-800"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="line-clamp-2 font-semibold text-white">{playlist.title || 'Sem título'}</h2>
        {playlist.is_default && (
          <span className="shrink-0 rounded-full bg-yellow-400/20 px-2 py-0.5 text-xs text-yellow-300">
            Padrão
          </span>
        )}
      </div>
      <p className="text-sm text-slate-400">
        {playlist.video_count} vídeo{playlist.video_count === 1 ? '' : 's'}
      </p>
      <p className="text-xs text-slate-500">{formatSyncedAt(playlist.last_synced_at)}</p>
    </button>
  )
}
