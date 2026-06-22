import type { VideoMoment } from '../api/client'
import { formatDuration } from '../utils/formatDuration'

interface VideoMomentChipsProps {
  moments: VideoMoment[]
  isActive: boolean
  layout?: 'stacked' | 'inline'
  onPlayMoment: (moment: VideoMoment) => void
  onDeleteMoment?: (moment: VideoMoment) => void
}

export function VideoMomentChips({
  moments,
  isActive,
  layout = 'stacked',
  onPlayMoment,
  onDeleteMoment,
}: VideoMomentChipsProps) {
  if (moments.length === 0) return null

  const containerClass =
    layout === 'inline'
      ? 'flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto'
      : 'mt-2 flex flex-wrap gap-2'

  return (
    <div className={containerClass} data-testid="video-moments">
      {moments.map((moment) => {
        const label = moment.label?.trim()
        const timeLabel = formatDuration(moment.position_seconds)
        return (
          <span key={moment.id} className="inline-flex items-center gap-1">
            <button
              type="button"
              data-testid="video-moment-chip"
              onClick={(event) => {
                event.stopPropagation()
                onPlayMoment(moment)
              }}
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition md:px-3 md:py-1.5 md:text-sm ${
                isActive
                  ? 'bg-yellow-300 text-yellow-950 hover:bg-yellow-200'
                  : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
              }`}
              title={label || `Ir para ${timeLabel}`}
            >
              {label ? `${timeLabel} · ${label}` : timeLabel}
            </button>
            {onDeleteMoment && (
              <button
                type="button"
                data-testid="video-moment-delete"
                aria-label={`Remover momento ${timeLabel}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onDeleteMoment(moment)
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-base ${
                  isActive ? 'text-yellow-800 hover:bg-yellow-200' : 'text-slate-400 hover:bg-slate-700'
                }`}
              >
                ×
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}
