import type { Video, VideoMoment } from '../api/client'
import { formatDuration, formatPublishedDate, highlightText, transcriptBadgeLabel } from '../utils/formatDuration'
import { VideoMomentChips } from './VideoMomentChips'
import { VideoPlaybackControls } from './VideoPlaybackControls'

interface VideoCardProps {
  video: Video
  isActive: boolean
  isSelected: boolean
  searchQuery?: string
  onSelect: (video: Video) => void
  onSelectedChange: (video: Video, selected: boolean) => void
  onPlayMoment: (video: Video, moment: VideoMoment) => void
  onDeleteMoment?: (video: Video, moment: VideoMoment) => void
  onReplayChange: (video: Video, replayEnabled: boolean) => void
  onLoopCountChange: (video: Video, loopCount: number) => void
  onReplayDurationChange: (video: Video, durationSeconds: number) => void
}

export function VideoCard({
  video,
  isActive,
  isSelected,
  searchQuery = '',
  onSelect,
  onSelectedChange,
  onPlayMoment,
  onDeleteMoment,
  onReplayChange,
  onLoopCountChange,
  onReplayDurationChange,
}: VideoCardProps) {
  const titleHtml = searchQuery
    ? { __html: highlightText(video.title, searchQuery) }
    : undefined
  const displayNumber = video.position + 1
  const publishedLabel = formatPublishedDate(video.published_at)

  const cardShellClass = isActive
    ? 'ring-2 ring-yellow-400 bg-yellow-50'
    : isSelected
      ? 'ring-2 ring-sky-500 bg-slate-900'
      : 'bg-slate-900 ring-1 ring-slate-800'

  const queueRailClass = isActive
    ? 'border-yellow-200 bg-yellow-100 text-yellow-900'
    : isSelected
      ? 'border-sky-600 bg-sky-950 text-sky-100'
      : 'border-slate-800 bg-slate-950 text-slate-400'

  return (
    <article
      data-testid={isActive ? 'video-card-active' : 'video-card'}
      className={`flex overflow-hidden rounded-xl transition ${cardShellClass}`}
    >
      <div
        className={`flex w-12 shrink-0 flex-col items-center justify-center gap-1.5 border-r px-1 py-3 ${queueRailClass}`}
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="checkbox"
          id={`video-queue-${video.id}`}
          data-testid="video-select-checkbox"
          checked={isSelected}
          onChange={(event) => onSelectedChange(video, event.target.checked)}
          className="h-5 w-5 rounded border-slate-500 accent-sky-500"
          aria-label={`Incluir ${video.title} na fila`}
        />
        <label
          htmlFor={`video-queue-${video.id}`}
          className="cursor-pointer text-center text-[10px] font-semibold uppercase leading-tight tracking-wide"
        >
          Fila
        </label>
      </div>

      <div className={`min-w-0 flex-1 ${isActive ? 'text-slate-900' : 'text-slate-100'}`}>
        <button
          type="button"
          onClick={() => onSelect(video)}
          className={`flex w-full gap-2 p-2.5 text-left md:gap-2.5 md:p-3 ${
            isActive ? 'hover:bg-yellow-100/70' : 'hover:bg-slate-800/70'
          }`}
        >
          <span
            className={`w-7 shrink-0 pt-0.5 text-right text-xs font-semibold tabular-nums md:w-8 md:text-sm ${
              isActive ? 'text-yellow-700' : 'text-slate-500'
            }`}
            aria-label={`Vídeo ${displayNumber}`}
          >
            {displayNumber}
          </span>

          <div className="relative shrink-0">
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="h-14 w-24 rounded-lg object-cover md:h-16 md:w-28"
            />
            <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-xs text-white">
              {formatDuration(video.duration_seconds)}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {video.is_new && (
                <span
                  data-testid="video-new-badge"
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isActive
                      ? 'bg-emerald-500 text-white'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  Novidade
                </span>
              )}
            </div>
            {titleHtml ? (
              <h3
                className="line-clamp-2 text-sm font-semibold md:text-base"
                dangerouslySetInnerHTML={titleHtml}
              />
            ) : (
              <h3 className="line-clamp-2 text-sm font-semibold md:text-base">{video.title}</h3>
            )}
            {publishedLabel && (
              <p
                data-testid="video-published-date"
                className={`mt-1 text-xs ${isActive ? 'text-slate-500' : 'text-slate-500'}`}
              >
                Publicado em {publishedLabel}
              </p>
            )}
            <p
              className={`mt-1 line-clamp-1 text-xs md:line-clamp-2 md:text-sm ${
                isActive ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              {video.description || 'Sem descrição'}
            </p>
            <span
              className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${
                isActive ? 'bg-yellow-200 text-yellow-900' : 'bg-slate-700 text-slate-200'
              }`}
            >
              {transcriptBadgeLabel(video.transcript_status)}
            </span>
            <VideoMomentChips
              moments={video.moments ?? []}
              isActive={isActive}
              onPlayMoment={(moment) => onPlayMoment(video, moment)}
              onDeleteMoment={
                onDeleteMoment ? (moment) => onDeleteMoment(video, moment) : undefined
              }
            />
          </div>
        </button>

        <div className={`border-t px-2.5 pb-2.5 pt-2 md:px-3 ${isActive ? 'border-yellow-200' : 'border-slate-800'}`}>
          <VideoPlaybackControls
            video={video}
            variant="card"
            isActive={isActive}
            onReplayChange={onReplayChange}
            onLoopCountChange={onLoopCountChange}
            onReplayDurationChange={onReplayDurationChange}
          />
        </div>
      </div>
    </article>
  )
}
