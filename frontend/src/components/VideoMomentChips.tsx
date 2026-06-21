import type { VideoMoment } from '../api/client'
import { formatDuration } from '../utils/formatDuration'

interface VideoMomentChipsProps {
  moments: VideoMoment[]
  isActive: boolean
  onPlayMoment: (moment: VideoMoment) => void
  onDeleteMoment?: (moment: VideoMoment) => void
}

export function VideoMomentChips({
  moments,
  isActive,
  onPlayMoment,
  onDeleteMoment,
}: VideoMomentChipsProps) {
  if (moments.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-1.5" data-testid="video-moments">
      {moments.map((moment) => {
        const label = moment.label?.trim()
        const timeLabel = formatDuration(moment.position_seconds)
        return (
          <span key={moment.id} className="inline-flex items-center gap-0.5">
            <button
              type="button"
              data-testid="video-moment-chip"
              onClick={(event) => {
                event.stopPropagation()
                onPlayMoment(moment)
              }}
              className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums transition ${
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
                className={`rounded-full px-1 text-xs ${
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
