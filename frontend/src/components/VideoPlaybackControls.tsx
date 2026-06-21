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

  const labelClass = isCard
    ? `flex items-center gap-2 text-xs md:text-sm ${
        isActive ? 'text-slate-700' : 'text-slate-300'
      }`
    : 'flex items-center gap-2 text-sm text-slate-200'

  const checkboxClass = 'h-4 w-4 rounded border-slate-500'

  const selectClass = isCard
    ? `rounded border px-2 py-1 text-xs md:text-sm ${
        isActive
          ? 'border-yellow-300 bg-white text-slate-900'
          : 'border-slate-600 bg-slate-800 text-slate-100'
      }`
    : 'rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white'

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      data-testid="video-playback-controls"
      onClick={(event) => event.stopPropagation()}
    >
      <label className={labelClass}>
        <input
          type="checkbox"
          data-testid="replay-checkbox"
          checked={video.replay_enabled}
          onChange={(event) => onReplayChange(video, event.target.checked)}
          className={checkboxClass}
        />
        Replay
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
  )
}
