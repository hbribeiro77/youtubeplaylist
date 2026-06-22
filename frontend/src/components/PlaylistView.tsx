import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Playlist, type Video, type VideoMoment } from '../api/client'
import { PlaylistHome } from './PlaylistHome'
import { SearchBar } from './SearchBar'
import { VideoCard } from './VideoCard'
import { VideoMomentChips } from './VideoMomentChips'
import { VideoPlaybackControls } from './VideoPlaybackControls'
import { VideoPlayer, type VideoPlayerHandle } from './VideoPlayer'
import { buildPlaylistMomentQueue } from '../utils/buildPlaylistMomentQueue'
import {
  countMomentsForVideos,
  filterVideosWithMoments,
  getVideosInPlaylistOrder,
} from '../utils/playlistVideoSelection'
import {
  formatPlaybackRate,
  loadGlobalPlaybackRate,
  saveGlobalPlaybackRate,
  type PlaybackRate,
  PLAYBACK_RATES,
} from '../utils/globalPlaybackRate'
import {
  DOUBLE_TAP_SEEK_OPTIONS,
  loadGlobalDoubleTapSeekSeconds,
  saveGlobalDoubleTapSeekSeconds,
  type DoubleTapSeekSeconds,
} from '../utils/globalDoubleTapSeek'

interface PlaylistViewProps {
  playlist: Playlist
  onBack: () => void
}

interface PendingSegment {
  videoId: string
  start: number
  duration: number
  loopRepeats: number
  onEnd?: () => void
}

interface PlayMomentOptions {
  forceSegment?: boolean
  ignoreLoop?: boolean
  onEnd?: () => void
}

export function PlaylistView({ playlist, onBack }: PlaylistViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const [startAtSeconds, setStartAtSeconds] = useState<number | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [markingMoment, setMarkingMoment] = useState(false)
  const [momentSequenceActive, setMomentSequenceActive] = useState(false)
  const [videoSequenceActive, setVideoSequenceActive] = useState(false)
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<number>>(() => new Set())
  const [showOnlyWithMoments, setShowOnlyWithMoments] = useState(false)
  const [globalPlaybackRate, setGlobalPlaybackRate] = useState<PlaybackRate>(() =>
    loadGlobalPlaybackRate(),
  )
  const [doubleTapSeekSeconds, setDoubleTapSeekSeconds] = useState<DoubleTapSeekSeconds>(() =>
    loadGlobalDoubleTapSeekSeconds(),
  )
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const playerRef = useRef<VideoPlayerHandle>(null)
  const pendingSegmentRef = useRef<PendingSegment | null>(null)
  const pendingMomentLoopRef = useRef<number | null>(null)
  const momentQueueRef = useRef<ReturnType<typeof buildPlaylistMomentQueue>>([])
  const videoSequenceRef = useRef<string[]>([])
  const queryClient = useQueryClient()

  const { data: videos = [], isLoading, error } = useQuery({
    queryKey: ['videos', playlist.id, searchQuery],
    queryFn: () => api.listVideos(playlist.id, searchQuery || undefined),
  })

  const activeVideo = videos.find((video) => video.youtube_video_id === activeVideoId) ?? null
  const momentQueue = useMemo(() => buildPlaylistMomentQueue(videos), [videos])
  const displayedVideos = useMemo(
    () => (showOnlyWithMoments ? filterVideosWithMoments(videos) : videos),
    [videos, showOnlyWithMoments],
  )
  const selectedMomentCount = useMemo(
    () => countMomentsForVideos(videos, selectedVideoIds),
    [videos, selectedVideoIds],
  )

  useEffect(() => {
    if (!activeVideoId) return
    const element = cardRefs.current[activeVideoId]
    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeVideoId])

  useEffect(() => {
    const pending = pendingSegmentRef.current
    if (!pending || pending.videoId !== activeVideoId) return

    const timer = window.setTimeout(() => {
      playerRef.current?.playSegment(pending.start, pending.duration, {
        loopRepeats: pending.loopRepeats,
        onEnd: pending.onEnd,
      })
      pendingSegmentRef.current = null
    }, 700)

    return () => window.clearTimeout(timer)
  }, [activeVideoId, startAtSeconds])

  useEffect(() => {
    if (pendingMomentLoopRef.current == null || !activeVideoId) return

    const start = pendingMomentLoopRef.current
    pendingMomentLoopRef.current = null

    const timer = window.setTimeout(() => {
      playerRef.current?.seekTo(start, { loopFromMoment: true })
    }, 700)

    return () => window.clearTimeout(timer)
  }, [activeVideoId, startAtSeconds])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const stopVideoSequence = useCallback(() => {
    videoSequenceRef.current = []
    setVideoSequenceActive(false)
  }, [])

  const stopMomentSequence = useCallback(() => {
    momentQueueRef.current = []
    setMomentSequenceActive(false)
    playerRef.current?.stopMomentSequence()
  }, [])

  const stopAllSequences = useCallback(() => {
    stopMomentSequence()
    stopVideoSequence()
  }, [stopMomentSequence, stopVideoSequence])

  const handleVideoEnded = useCallback(() => {
    if (!videoSequenceActive) return

    const queue = videoSequenceRef.current
    const currentId = activeVideoId?.trim()
    if (!currentId) return

    const index = queue.indexOf(currentId)
    const nextId = queue[index + 1]
    if (!nextId) {
      stopVideoSequence()
      return
    }

    pendingSegmentRef.current = null
    pendingMomentLoopRef.current = null
    setStartAtSeconds(null)
    setActiveVideoId(nextId)
  }, [activeVideoId, stopVideoSequence, videoSequenceActive])

  const playMomentOnVideo = useCallback(
    (video: Video, moment: VideoMoment, options?: PlayMomentOptions) => {
      const id = video.youtube_video_id?.trim()
      if (!id) return

      playerRef.current?.cancelSegmentPlayback()

      const useSegment = video.replay_enabled || options?.forceSegment
      const loopRepeats =
        !options?.ignoreLoop && video.replay_enabled ? video.loop_count : 0

      if (useSegment) {
        const duration = video.replay_duration_seconds
        const segmentOptions = {
          loopRepeats,
          onEnd: options?.onEnd,
        }

        if (id === activeVideoId) {
          playerRef.current?.playSegment(moment.position_seconds, duration, segmentOptions)
          return
        }

        pendingSegmentRef.current = {
          videoId: id,
          start: moment.position_seconds,
          duration,
          loopRepeats,
          onEnd: options?.onEnd,
        }
        setStartAtSeconds(moment.position_seconds)
        setActiveVideoId(id)
        return
      }

      if (id === activeVideoId) {
        playerRef.current?.seekTo(moment.position_seconds, {
          loopFromMoment:
            !options?.ignoreLoop && !video.replay_enabled && video.loop_count === -1,
        })
        return
      }

      pendingSegmentRef.current = null
      if (!options?.ignoreLoop && !video.replay_enabled && video.loop_count === -1) {
        pendingMomentLoopRef.current = moment.position_seconds
      }
      setStartAtSeconds(moment.position_seconds)
      setActiveVideoId(id)
    },
    [activeVideoId],
  )

  const playMomentSequenceAt = useCallback(
    (index: number) => {
      const queue = momentQueueRef.current
      const item = queue[index]
      if (!item) {
        setMomentSequenceActive(false)
        return
      }

      playMomentOnVideo(item.video, item.moment, {
        forceSegment: true,
        ignoreLoop: true,
        onEnd: () => playMomentSequenceAt(index + 1),
      })
    },
    [playMomentOnVideo],
  )

  const handleSelect = (video: Video) => {
    const id = video.youtube_video_id?.trim()
    if (!id) return
    stopAllSequences()
    playerRef.current?.cancelSegmentPlayback()
    pendingSegmentRef.current = null
    pendingMomentLoopRef.current = null
    setStartAtSeconds(null)
    setActiveVideoId(id)
  }

  const handleSelectedChange = (video: Video, selected: boolean) => {
    setSelectedVideoIds((current) => {
      const next = new Set(current)
      if (selected) {
        next.add(video.id)
      } else {
        next.delete(video.id)
      }
      return next
    })
  }

  const handlePlaySelectedVideos = () => {
    const selected = getVideosInPlaylistOrder(videos, selectedVideoIds)
    if (selected.length === 0) return

    stopMomentSequence()
    const ids = selected
      .map((video) => video.youtube_video_id?.trim())
      .filter((id): id is string => Boolean(id))

    if (ids.length === 0) return

    videoSequenceRef.current = ids
    setVideoSequenceActive(true)
    pendingSegmentRef.current = null
    pendingMomentLoopRef.current = null
    setStartAtSeconds(null)
    setActiveVideoId(ids[0])
  }

  const handlePlaySelectedMoments = () => {
    const queue = buildPlaylistMomentQueue(videos, selectedVideoIds)
    if (queue.length === 0) return

    stopVideoSequence()
    momentQueueRef.current = queue
    setMomentSequenceActive(true)
    playMomentSequenceAt(0)
  }

  const handlePlayMoment = (video: Video, moment: VideoMoment) => {
    stopAllSequences()
    playMomentOnVideo(video, moment)
  }

  const handlePlayMomentSequence = () => {
    if (momentQueue.length === 0) return

    stopVideoSequence()
    momentQueueRef.current = momentQueue
    setMomentSequenceActive(true)
    playMomentSequenceAt(0)
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

  const handleLoopCountChange = async (video: Video, loopCount: number) => {
    await api.updateVideoReplay(video.id, { loop_count: loopCount })
    await queryClient.invalidateQueries({ queryKey: ['videos', playlist.id] })
  }

  const handleReplayDurationChange = async (video: Video, durationSeconds: number) => {
    await api.updateVideoReplay(video.id, { replay_duration_seconds: durationSeconds })
    await queryClient.invalidateQueries({ queryKey: ['videos', playlist.id] })
  }

  const handleGlobalPlaybackRateChange = (rate: PlaybackRate) => {
    setGlobalPlaybackRate(rate)
    saveGlobalPlaybackRate(rate)
  }

  const handleDoubleTapSeekChange = (seconds: DoubleTapSeekSeconds) => {
    setDoubleTapSeekSeconds(seconds)
    saveGlobalDoubleTapSeekSeconds(seconds)
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
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-3">
        <button
          type="button"
          data-testid="back-to-playlists"
          onClick={onBack}
          className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200"
        >
          ← Playlists
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold md:text-lg">{playlist.title}</h1>
        <label className="flex shrink-0 items-center gap-2 text-sm text-slate-200">
          <span className="hidden sm:inline">Velocidade</span>
          <select
            data-testid="global-playback-rate"
            className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white"
            value={globalPlaybackRate}
            onChange={(event) =>
              handleGlobalPlaybackRateChange(Number(event.target.value) as PlaybackRate)
            }
          >
            {PLAYBACK_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {formatPlaybackRate(rate)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex shrink-0 items-center gap-2 text-sm text-slate-200">
          <span className="hidden sm:inline">Toque 2x</span>
          <select
            data-testid="global-double-tap-seek"
            className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white"
            value={doubleTapSeekSeconds}
            onChange={(event) =>
              handleDoubleTapSeekChange(Number(event.target.value) as DoubleTapSeekSeconds)
            }
          >
            {DOUBLE_TAP_SEEK_OPTIONS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds}s
              </option>
            ))}
          </select>
        </label>
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
            playbackRate={globalPlaybackRate}
            doubleTapSeekSeconds={doubleTapSeekSeconds}
            onVideoChange={setActiveVideoId}
            onVideoEnded={handleVideoEnded}
            onMarkMoment={handleMarkMoment}
            markingDisabled={markingMoment || !activeVideo}
            toolbarExtra={
              <>
                {activeVideo && (
                  <VideoPlaybackControls
                    video={activeVideo}
                    variant="player"
                    onReplayChange={handleReplayChange}
                    onLoopCountChange={handleLoopCountChange}
                    onReplayDurationChange={handleReplayDurationChange}
                  />
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {momentQueue.length > 0 && (
                    <>
                      <button
                        type="button"
                        data-testid="play-moment-sequence"
                        disabled={momentSequenceActive}
                        onClick={handlePlayMomentSequence}
                        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ▶ Momentos em sequência ({momentQueue.length})
                      </button>
                      {momentSequenceActive && (
                        <button
                          type="button"
                          data-testid="stop-moment-sequence"
                          onClick={stopMomentSequence}
                          className="rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                        >
                          Parar sequência
                        </button>
                      )}
                    </>
                  )}
                </div>

                {activeVideo && (activeVideo.moments?.length ?? 0) > 0 && (
                  <div className="mt-3 border-t border-slate-800 pt-3">
                    <p className="mb-2 text-sm font-medium text-slate-200">Momentos deste vídeo</p>
                    <VideoMomentChips
                      moments={activeVideo.moments}
                      isActive
                      onPlayMoment={(moment) => handlePlayMoment(activeVideo, moment)}
                      onDeleteMoment={(moment) => handleDeleteMoment(activeVideo, moment)}
                    />
                  </div>
                )}
              </>
            }
          />
        </aside>

        <main
          className="flex min-w-0 flex-col md:max-h-[calc(100vh-57px)] md:w-[38%] md:overflow-hidden lg:w-[35%]"
          data-testid="videos-column"
        >
          <SearchBar onSearch={handleSearch} />

          <div
            className="flex flex-col gap-2 border-b border-slate-800 px-3 py-2"
            data-testid="video-list-toolbar"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Fila e filtros
            </p>
            <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-300">
              <input
                type="checkbox"
                data-testid="filter-with-moments"
                checked={showOnlyWithMoments}
                onChange={(event) => setShowOnlyWithMoments(event.target.checked)}
                className="h-4 w-4 rounded border-slate-500"
              />
              Só com momentos
            </label>

            <button
              type="button"
              data-testid="play-selected-videos"
              disabled={selectedVideoIds.size === 0 || videoSequenceActive}
              onClick={handlePlaySelectedVideos}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              ▶ Selecionados ({selectedVideoIds.size})
            </button>

            <button
              type="button"
              data-testid="play-selected-moments"
              disabled={selectedMomentCount === 0 || momentSequenceActive}
              onClick={handlePlaySelectedMoments}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              ▶ Momentos ({selectedMomentCount})
            </button>

            {videoSequenceActive && (
              <button
                type="button"
                data-testid="stop-video-sequence"
                onClick={stopVideoSequence}
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-white"
              >
                Parar vídeos
              </button>
            )}

            {momentSequenceActive && (
              <button
                type="button"
                data-testid="stop-moment-sequence-list"
                onClick={stopMomentSequence}
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-white"
              >
                Parar momentos
              </button>
            )}
            </div>
          </div>

          <div
            className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-8 md:px-4"
            data-testid="video-list"
          >
            {isLoading && <p className="px-2 text-sm text-slate-400">Carregando vídeos...</p>}
            {error && <p className="px-2 text-sm text-red-400">{(error as Error).message}</p>}
            {!isLoading && videos.length === 0 && (
              <p className="px-2 text-sm text-slate-400">Nenhum vídeo encontrado.</p>
            )}
            {!isLoading && displayedVideos.length === 0 && videos.length > 0 && (
              <p className="px-2 text-sm text-slate-400">Nenhum vídeo com momentos marcados.</p>
            )}
            {!isLoading && videos.length > 0 && (
              <p className="px-2 text-xs text-slate-500">
                {displayedVideos.length} exibido{displayedVideos.length === 1 ? '' : 's'} de{' '}
                {videos.length} vídeo{videos.length === 1 ? '' : 's'}
                {playlist.video_count > videos.length ? ` (playlist com ${playlist.video_count})` : ''}
                {selectedVideoIds.size > 0 ? ` · ${selectedVideoIds.size} selecionado${selectedVideoIds.size === 1 ? '' : 's'}` : ''}
                {momentQueue.length > 0 ? ` · ${momentQueue.length} momentos na playlist` : ''}
              </p>
            )}
            {displayedVideos.map((video) => (
              <div
                key={video.id}
                ref={(el) => {
                  cardRefs.current[video.youtube_video_id] =
                    el?.querySelector<HTMLButtonElement>('button[type="button"]') ?? null
                }}
              >
                <VideoCard
                  video={video}
                  isActive={video.youtube_video_id === activeVideoId}
                  isSelected={selectedVideoIds.has(video.id)}
                  searchQuery={searchQuery}
                  onSelect={handleSelect}
                  onSelectedChange={handleSelectedChange}
                  onPlayMoment={handlePlayMoment}
                  onDeleteMoment={handleDeleteMoment}
                  onReplayChange={handleReplayChange}
                  onLoopCountChange={handleLoopCountChange}
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
