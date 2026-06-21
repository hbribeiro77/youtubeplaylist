import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Playlist, type Video, type VideoMoment } from '../api/client'
import { PlaylistHome } from './PlaylistHome'
import { SearchBar } from './SearchBar'
import { VideoCard } from './VideoCard'
import { VideoMomentChips } from './VideoMomentChips'
import { VideoPlayer, type VideoPlayerHandle } from './VideoPlayer'

interface PlaylistViewProps {
  playlist: Playlist
  onBack: () => void
}

export function PlaylistView({ playlist, onBack }: PlaylistViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const [startAtSeconds, setStartAtSeconds] = useState<number | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [markingMoment, setMarkingMoment] = useState(false)
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const playerRef = useRef<VideoPlayerHandle>(null)
  const pendingSegmentRef = useRef<{
    videoId: string
    start: number
    duration: number
  } | null>(null)
  const queryClient = useQueryClient()

  const { data: videos = [], isLoading, error } = useQuery({
    queryKey: ['videos', playlist.id, searchQuery],
    queryFn: () => api.listVideos(playlist.id, searchQuery || undefined),
  })

  const activeVideo = videos.find((video) => video.youtube_video_id === activeVideoId) ?? null

  useEffect(() => {
    if (!activeVideoId && videos.length > 0) {
      const firstId = videos[0].youtube_video_id?.trim()
      if (firstId) setActiveVideoId(firstId)
    }
  }, [videos, activeVideoId])

  useEffect(() => {
    if (!activeVideoId) return
    const element = cardRefs.current[activeVideoId]
    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeVideoId])

  useEffect(() => {
    const pending = pendingSegmentRef.current
    if (!pending || pending.videoId !== activeVideoId) return

    const timer = window.setTimeout(() => {
      playerRef.current?.playSegment(pending.start, pending.duration)
      pendingSegmentRef.current = null
    }, 700)

    return () => window.clearTimeout(timer)
  }, [activeVideoId, startAtSeconds])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleSelect = (video: Video) => {
    const id = video.youtube_video_id?.trim()
    if (!id) return
    playerRef.current?.cancelSegmentPlayback()
    pendingSegmentRef.current = null
    setStartAtSeconds(null)
    setActiveVideoId(id)
  }

  const handlePlayMoment = (video: Video, moment: VideoMoment) => {
    const id = video.youtube_video_id?.trim()
    if (!id) return

    playerRef.current?.cancelSegmentPlayback()

    if (video.replay_enabled) {
      const duration = video.replay_duration_seconds
      if (id === activeVideoId) {
        playerRef.current?.playSegment(moment.position_seconds, duration)
        return
      }

      pendingSegmentRef.current = {
        videoId: id,
        start: moment.position_seconds,
        duration,
      }
      setStartAtSeconds(moment.position_seconds)
      setActiveVideoId(id)
      return
    }

    if (id === activeVideoId) {
      playerRef.current?.seekTo(moment.position_seconds)
      return
    }

    pendingSegmentRef.current = null
    setStartAtSeconds(moment.position_seconds)
    setActiveVideoId(id)
  }

  const handleMarkMoment = async () => {
    if (!activeVideo || !playerRef.current) return

    setMarkingMoment(true)
    try {
      const positionSeconds = playerRef.current.getCurrentTime()
      await api.addVideoMoment(activeVideo.id, positionSeconds)
      await queryClient.invalidateQueries({ queryKey: ['videos', playlist.id] })
    } finally {
      setMarkingMoment(false)
    }
  }

  const handleDeleteMoment = async (video: Video, moment: VideoMoment) => {
    await api.deleteVideoMoment(video.id, moment.id)
    await queryClient.invalidateQueries({ queryKey: ['videos', playlist.id] })
  }

  const handleReplayChange = async (video: Video, replayEnabled: boolean) => {
    await api.updateVideoReplay(video.id, { replay_enabled: replayEnabled })
    await queryClient.invalidateQueries({ queryKey: ['videos', playlist.id] })
  }

  const handleReplayDurationChange = async (video: Video, durationSeconds: number) => {
    await api.updateVideoReplay(video.id, { replay_duration_seconds: durationSeconds })
    await queryClient.invalidateQueries({ queryKey: ['videos', playlist.id] })
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await api.syncPlaylist(playlist.id)
      await queryClient.invalidateQueries({ queryKey: ['videos', playlist.id] })
      await queryClient.invalidateQueries({ queryKey: ['playlists'] })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[96rem] flex-col">
      <header className="flex items-center gap-2 border-b border-slate-800 px-3 py-3">
        <button
          type="button"
          data-testid="back-to-playlists"
          onClick={onBack}
          className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200"
        >
          ← Playlists
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold md:text-lg">{playlist.title}</h1>
        <button
          type="button"
          data-testid="sync-playlist"
          onClick={handleSync}
          disabled={syncing}
          className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 disabled:opacity-60"
        >
          {syncing ? '...' : 'Sync'}
        </button>
      </header>

      <div className="flex flex-1 flex-col md:min-h-[calc(100vh-57px)] md:flex-row">
        <aside
          className="md:sticky md:top-[57px] md:flex md:h-[calc(100vh-57px)] md:min-w-0 md:w-[62%] md:shrink-0 md:flex-col md:border-r md:border-slate-800 lg:w-[65%]"
          data-testid="player-column"
        >
          <VideoPlayer
            ref={playerRef}
            videoId={activeVideoId}
            startAtSeconds={startAtSeconds}
            onVideoChange={setActiveVideoId}
            onMarkMoment={handleMarkMoment}
            markingDisabled={markingMoment || !activeVideo}
            toolbarExtra={
              activeVideo && (activeVideo.moments?.length ?? 0) > 0 ? (
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-200">Momentos deste vídeo</p>
                  <VideoMomentChips
                    moments={activeVideo.moments}
                    isActive
                    onPlayMoment={(moment) => handlePlayMoment(activeVideo, moment)}
                    onDeleteMoment={(moment) => handleDeleteMoment(activeVideo, moment)}
                  />
                </div>
              ) : undefined
            }
          />
        </aside>

        <main
          className="flex min-w-0 flex-col md:max-h-[calc(100vh-57px)] md:w-[38%] md:overflow-hidden lg:w-[35%]"
          data-testid="videos-column"
        >
          <SearchBar onSearch={handleSearch} />

          <div
            className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-8 md:px-4"
            data-testid="video-list"
          >
            {isLoading && <p className="px-2 text-sm text-slate-400">Carregando vídeos...</p>}
            {error && <p className="px-2 text-sm text-red-400">{(error as Error).message}</p>}
            {!isLoading && videos.length === 0 && (
              <p className="px-2 text-sm text-slate-400">Nenhum vídeo encontrado.</p>
            )}
            {!isLoading && videos.length > 0 && (
              <p className="px-2 text-xs text-slate-500">
                {videos.length} vídeo{videos.length === 1 ? '' : 's'}
                {playlist.video_count > videos.length ? ` (playlist com ${playlist.video_count})` : ''}
              </p>
            )}
            {videos.map((video) => (
              <div
                key={video.id}
                ref={(el) => {
                  cardRefs.current[video.youtube_video_id] =
                    el?.querySelector<HTMLButtonElement>('button') ?? null
                }}
              >
                <VideoCard
                  video={video}
                  isActive={video.youtube_video_id === activeVideoId}
                  searchQuery={searchQuery}
                  onSelect={handleSelect}
                  onPlayMoment={handlePlayMoment}
                  onDeleteMoment={handleDeleteMoment}
                  onReplayChange={handleReplayChange}
                  onReplayDurationChange={handleReplayDurationChange}
                />
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

export function PlaylistApp() {
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null)

  if (selectedPlaylist) {
    return (
      <PlaylistView
        playlist={selectedPlaylist}
        onBack={() => setSelectedPlaylist(null)}
      />
    )
  }

  return <PlaylistHome onOpenPlaylist={setSelectedPlaylist} />
}
