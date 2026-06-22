import type { Video } from '../api/client'
import { LOOP_COUNT_OPTIONS, REPLAY_DURATION_OPTIONS } from '../api/client'

interface VideoPlaybackControlsProps {
  video: Video
  variant: 'card' | 'player'
  isActive?: boolean
  onReplayChange: (video: Video, replayEnabled: boolean) => void
  onLoopCountChange: (video: Video, loopCount: number) => void
  onReplayDurationChange: (video: Video, durationSeconds: number) => void
}

export function VideoPlaybackControls({
  video,
  variant,
  isActive = false,
  onReplayChange,
  onLoopCountChange,
  onReplayDurationChange,
}: VideoPlaybackControlsProps) {
  const isCard = variant === 'card'

  if (isCard) {
    const panelClass = isActive
      ? 'bg-yellow-100/80 border-yellow-200'
      : 'bg-slate-950/60 border-slate-800'
    const headingClass = isActive ? 'text-yellow-900' : 'text-slate-400'
    const fieldLabelClass = isActive ? 'text-slate-600' : 'text-slate-400'
    const selectClass = isActive
      ? 'w-full rounded-md border border-yellow-300 bg-white px-2 py-1.5 text-sm text-slate-900'
      : 'w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100'
    const toggleLabelClass = isActive ? 'text-slate-700' : 'text-slate-300'

    return (
      <section
        className={`rounded-lg border px-3 py-2.5 ${panelClass}`}
        data-testid="video-playback-controls"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${headingClass}`}>
              Replay de momentos
            </p>
            <p className={`mt-0.5 text-xs ${fieldLabelClass}`}>
              Ao clicar num atalho, toca um trecho curto
            </p>
          </div>
          <label className={`flex shrink-0 items-center gap-2 text-sm font-medium ${toggleLabelClass}`}>
            <span className="sr-only">Ativar replay de momentos</span>
            <input
              type="checkbox"
              data-testid="replay-checkbox"
              checked={video.replay_enabled}
              onChange={(event) => onReplayChange(video, event.target.checked)}
              className="h-4 w-4 rounded border-slate-500"
            />
            <span>{video.replay_enabled ? 'Ligado' : 'Desligado'}</span>
          </label>
        </div>

        {video.replay_enabled && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className={`text-xs font-medium ${fieldLabelClass}`}>Duração do trecho</span>
              <select
                data-testid="replay-duration-select"
                value={video.replay_duration_seconds}
                onChange={(event) => onReplayDurationChange(video, Number(event.target.value))}
                className={selectClass}
              >
                {REPLAY_DURATION_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds} segundos
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className={`text-xs font-medium ${fieldLabelClass}`}>Repetições</span>
              <select
                data-testid="loop-count-select"
                value={video.loop_count}
                onChange={(event) => onLoopCountChange(video, Number(event.target.value))}
                className={selectClass}
              >
                {LOOP_COUNT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label === 'Não'
                      ? 'Sem repetição'
                      : option.label === '∞'
                        ? 'Infinito'
                        : `${option.label}x`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </section>
    )
  }

  const labelClass = 'flex items-center gap-2 text-sm text-slate-200'
  const selectClass =
    'rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white'

  return (
    <div
      className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5"
      data-testid="video-playback-controls"
      onClick={(event) => event.stopPropagation()}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Replay de momentos
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className={labelClass}>
          <input
            type="checkbox"
            data-testid="replay-checkbox"
            checked={video.replay_enabled}
            onChange={(event) => onReplayChange(video, event.target.checked)}
            className="h-4 w-4 rounded border-slate-500"
          />
          Ativar
        </label>

        {video.replay_enabled && (
          <>
            <label className={labelClass}>
              <span>Duração</span>
              <select
                data-testid="replay-duration-select"
                value={video.replay_duration_seconds}
                onChange={(event) => onReplayDurationChange(video, Number(event.target.value))}
                className={selectClass}
              >
                {REPLAY_DURATION_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds}s
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              <span>Repetições</span>
              <select
                data-testid="loop-count-select"
                value={video.loop_count}
                onChange={(event) => onLoopCountChange(video, Number(event.target.value))}
                className={selectClass}
              >
                {LOOP_COUNT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
    </div>
  )
}
