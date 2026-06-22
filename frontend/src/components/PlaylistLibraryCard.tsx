import type { Playlist, PlaylistSyncResult } from '../api/client'

interface PlaylistLibraryCardProps {
  playlist: Playlist
  syncing?: boolean
  lastSyncMessage?: string | null
  onSelect: (playlist: Playlist) => void
  onSync: (playlist: Playlist) => void
}

function formatSyncedAt(value: string | null): string {
  if (!value) return 'Nunca sincronizada'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sincronizada'
  return `Atualizada em ${date.toLocaleDateString('pt-BR')}`
}

export function PlaylistLibraryCard({
  playlist,
  syncing = false,
  lastSyncMessage = null,
  onSelect,
  onSync,
}: PlaylistLibraryCardProps) {
  return (
    <div
      data-testid="playlist-library-card"
      className="flex gap-2 rounded-xl border border-slate-700 bg-slate-900 p-4 transition hover:border-yellow-400"
    >
      <button
        type="button"
        onClick={() => onSelect(playlist)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="line-clamp-2 font-semibold text-white">{playlist.title || 'Sem título'}</h2>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {playlist.is_default && (
              <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-xs text-yellow-300">
                Padrão
              </span>
            )}
            {playlist.new_video_count > 0 && (
              <span
                data-testid="playlist-new-count"
                className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300"
              >
                {playlist.new_video_count} novidade{playlist.new_video_count === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          {playlist.video_count} vídeo{playlist.video_count === 1 ? '' : 's'}
        </p>
        <p className="mt-1 text-xs text-slate-500">{formatSyncedAt(playlist.last_synced_at)}</p>
        {lastSyncMessage && (
          <p className="mt-2 text-xs font-medium text-emerald-300" data-testid="playlist-sync-message">
            {lastSyncMessage}
          </p>
        )}
      </button>

      <button
        type="button"
        data-testid="playlist-sync-button"
        disabled={syncing}
        onClick={() => onSync(playlist)}
        className="shrink-0 self-start rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 disabled:opacity-60"
      >
        {syncing ? '...' : 'Sync'}
      </button>
    </div>
  )
}

export type { PlaylistSyncResult }
