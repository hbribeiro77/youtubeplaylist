import type { Video, VideoMoment } from '../api/client'
import { formatDuration, highlightText, transcriptBadgeLabel } from '../utils/formatDuration'
import { VideoMomentChips } from './VideoMomentChips'

interface VideoCardProps {
  video: Video
  isActive: boolean
  searchQuery?: string
  onSelect: (video: Video) => void
  onPlayMoment: (video: Video, moment: VideoMoment) => void
  onDeleteMoment?: (video: Video, moment: VideoMoment) => void
}

export function VideoCard({
  video,
  isActive,
  searchQuery = '',
  onSelect,
  onPlayMoment,
  onDeleteMoment,
}: VideoCardProps) {
  const titleHtml = searchQuery
    ? { __html: highlightText(video.title, searchQuery) }
    : undefined
  const displayNumber = video.position + 1

  return (
    <button
      type="button"
      data-testid={isActive ? 'video-card-active' : 'video-card'}
      onClick={() => onSelect(video)}
      className={`flex w-full gap-3 rounded-xl p-3 text-left transition ${
        isActive
          ? 'bg-yellow-50 text-slate-900 ring-2 ring-yellow-400'
          : 'bg-slate-900 text-slate-100 hover:bg-slate-800'
      }`}
    >
      <span
        className={`w-8 shrink-0 pt-1 text-right text-sm font-semibold tabular-nums ${
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
          className="h-20 w-36 rounded-lg object-cover"
        />
        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-xs text-white">
          {formatDuration(video.duration_seconds)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        {titleHtml ? (
          <h3
            className="line-clamp-2 font-semibold"
            dangerouslySetInnerHTML={titleHtml}
          />
        ) : (
          <h3 className="line-clamp-2 font-semibold">{video.title}</h3>
        )}
        <p className={`mt-1 line-clamp-2 text-sm ${isActive ? 'text-slate-600' : 'text-slate-400'}`}>
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
          onDeleteMoment={onDeleteMoment ? (moment) => onDeleteMoment(video, moment) : undefined}
        />
      </div>
    </button>
  )
}
