import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { isValidYouTubeVideoId, normalizeYouTubeVideoId } from '../utils/youtubeVideoId'
import { hasSegmentReachedEnd } from '../utils/videoSegmentPlayback'
import {
  clampSeekPosition,
  doubleTapTiming,
  formatDoubleTapSeekHint,
  getDoubleTapSeekDelta,
  getDoubleTapSeekDirection,
} from '../utils/globalDoubleTapSeek'

declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
  }
}

export interface VideoPlayerHandle {
  getCurrentTime: () => number
  seekTo: (seconds: number, options?: { loopFromMoment?: boolean }) => void
  playSegment: (
    startSeconds: number,
    durationSeconds: number,
    options?: { loopRepeats?: number; onEnd?: () => void },
  ) => void
  cancelSegmentPlayback: () => void
  stopMomentSequence: () => void
}

interface VideoPlayerProps {
  videoId: string | null
  startAtSeconds?: number | null
  playbackRate?: number
  doubleTapSeekSeconds?: number
  onVideoChange?: (videoId: string) => void
  onMarkMoment?: () => void
  markingDisabled?: boolean
  toolbarExtra?: ReactNode
  className?: string
}

let apiReadyPromise: Promise<void> | null = null

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (!apiReadyPromise) {
    apiReadyPromise = new Promise((resolve) => {
      const existing = document.getElementById('youtube-iframe-api')
      if (!existing) {
        const script = document.createElement('script')
        script.id = 'youtube-iframe-api'
        script.src = 'https://www.youtube.com/iframe_api'
        document.body.appendChild(script)
      }
      const previous = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        previous?.()
        resolve()
      }
      if (window.YT?.Player) resolve()
    })
  }
  return apiReadyPromise
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer(
  {
    videoId,
    startAtSeconds = null,
    playbackRate = 1,
    doubleTapSeekSeconds = 10,
    onVideoChange,
    onMarkMoment,
    markingDisabled = false,
    toolbarExtra,
    className = '',
  },
  ref,
) {
  const shellRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const readyRef = useRef(false)
  const pendingVideoRef = useRef<string | null>(normalizeYouTubeVideoId(videoId))
  const pendingStartRef = useRef<number | null>(startAtSeconds)
  const segmentWatchRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const segmentActiveRef = useRef(false)
  const segmentLoopsRemainingRef = useRef(0)
  const segmentOnEndRef = useRef<(() => void) | null>(null)
  const segmentStartRef = useRef(0)
  const segmentDurationRef = useRef(0)
  const handleSegmentEndRef = useRef<() => void>(() => {})
  const momentLoopStartRef = useRef<number | null>(null)
  const tapOverlayRef = useRef<HTMLDivElement>(null)
  const lastTapRef = useRef<{ time: number; x: number } | null>(null)
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seekHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [seekHint, setSeekHint] = useState<string | null>(null)
  const [seekHintSide, setSeekHintSide] = useState<'left' | 'right'>('right')
  const [mountKey, setMountKey] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const clearSegmentWatch = useCallback(() => {
    if (segmentWatchRef.current) {
      clearInterval(segmentWatchRef.current)
      segmentWatchRef.current = null
    }
  }, [])

  const clearMomentLoop = useCallback(() => {
    momentLoopStartRef.current = null
  }, [])

  const finishSegmentPlayback = useCallback(() => {
    segmentActiveRef.current = false
    playerRef.current?.pauseVideo()

    const onEnd = segmentOnEndRef.current
    segmentOnEndRef.current = null
    onEnd?.()
  }, [])

  const runSegmentPlayback = useCallback(() => {
    if (!playerRef.current || !readyRef.current) return

    const startSeconds = segmentStartRef.current

    segmentActiveRef.current = true
    playerRef.current.seekTo(startSeconds, true)
    playerRef.current.playVideo()

    clearSegmentWatch()
    segmentWatchRef.current = setInterval(() => {
      if (!playerRef.current || !readyRef.current || !segmentActiveRef.current) return

      const current = playerRef.current.getCurrentTime?.()
      if (typeof current !== 'number' || !Number.isFinite(current)) return

      if (hasSegmentReachedEnd(current, startSeconds, segmentDurationRef.current)) {
        handleSegmentEndRef.current()
      }
    }, 100)
  }, [clearSegmentWatch])

  const handleSegmentEnd = useCallback(() => {
    clearSegmentWatch()

    const remaining = segmentLoopsRemainingRef.current
    if (remaining === -1) {
      runSegmentPlayback()
      return
    }

    if (remaining > 0) {
      segmentLoopsRemainingRef.current = remaining - 1
      runSegmentPlayback()
      return
    }

    finishSegmentPlayback()
  }, [clearSegmentWatch, finishSegmentPlayback, runSegmentPlayback])

  useEffect(() => {
    handleSegmentEndRef.current = handleSegmentEnd
  }, [handleSegmentEnd])

  const stopSegmentPlayback = useCallback(() => {
    clearSegmentWatch()
    segmentActiveRef.current = false
    segmentLoopsRemainingRef.current = 0
    segmentOnEndRef.current = null
    clearMomentLoop()
  }, [clearMomentLoop, clearSegmentWatch])

  const clearSingleTapTimer = useCallback(() => {
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current)
      singleTapTimerRef.current = null
    }
  }, [])

  const showSeekHint = useCallback((deltaSeconds: number) => {
    if (seekHintTimerRef.current) {
      clearTimeout(seekHintTimerRef.current)
    }

    setSeekHintSide(deltaSeconds > 0 ? 'right' : 'left')
    setSeekHint(formatDoubleTapSeekHint(deltaSeconds))

    seekHintTimerRef.current = setTimeout(() => {
      setSeekHint(null)
      seekHintTimerRef.current = null
    }, 700)
  }, [])

  const seekRelative = useCallback(
    (deltaSeconds: number) => {
      stopSegmentPlayback()
      if (!playerRef.current || !readyRef.current) return

      const current = playerRef.current.getCurrentTime?.() ?? 0
      const duration = playerRef.current.getDuration?.() ?? 0
      const next = clampSeekPosition(current, duration, deltaSeconds)

      playerRef.current.seekTo(next, true)
      playerRef.current.playVideo()
      showSeekHint(deltaSeconds)
    },
    [showSeekHint, stopSegmentPlayback],
  )

  const togglePlayPause = useCallback(() => {
    if (!playerRef.current || !readyRef.current) return

    const state = playerRef.current.getPlayerState?.()
    if (state === window.YT.PlayerState.PLAYING) {
      playerRef.current.pauseVideo()
      return
    }

    playerRef.current.playVideo()
  }, [])

  const handleMouseClick = useCallback(() => {
      if (playerError) return

      lastTapRef.current = null
      clearSingleTapTimer()
      singleTapTimerRef.current = setTimeout(() => {
        togglePlayPause()
      }, doubleTapTiming.singleTapDelayMs)
  }, [clearSingleTapTimer, playerError, togglePlayPause])

  const handleTouchTap = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (playerError) return

      const overlay = tapOverlayRef.current
      if (!overlay) return

      const rect = overlay.getBoundingClientRect()
      const tapX = event.clientX - rect.left
      const now = Date.now()
      const lastTap = lastTapRef.current

      if (
        lastTap &&
        now - lastTap.time <= doubleTapTiming.doubleTapWindowMs &&
        Math.abs(tapX - lastTap.x) <= 80
      ) {
        clearSingleTapTimer()
        lastTapRef.current = null

        const direction = getDoubleTapSeekDirection(tapX, rect.width)
        const delta = getDoubleTapSeekDelta(direction, doubleTapSeekSeconds)
        seekRelative(delta)
        return
      }

      lastTapRef.current = { time: now, x: tapX }
      clearSingleTapTimer()
      singleTapTimerRef.current = setTimeout(() => {
        lastTapRef.current = null
        togglePlayPause()
      }, doubleTapTiming.singleTapDelayMs)
    },
    [clearSingleTapTimer, doubleTapSeekSeconds, playerError, seekRelative, togglePlayPause],
  )

  const handleTapOverlay = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'touch') {
        handleTouchTap(event)
        return
      }

      handleMouseClick()
    },
    [handleMouseClick, handleTouchTap],
  )

  const handleDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (playerError) return

      const overlay = tapOverlayRef.current
      if (!overlay) return

      clearSingleTapTimer()
      lastTapRef.current = null

      const rect = overlay.getBoundingClientRect()
      const tapX = event.clientX - rect.left
      const direction = getDoubleTapSeekDirection(tapX, rect.width)
      const delta = getDoubleTapSeekDelta(direction, doubleTapSeekSeconds)
      seekRelative(delta)
    },
    [clearSingleTapTimer, doubleTapSeekSeconds, playerError, seekRelative],
  )

  useEffect(() => {
    return () => {
      clearSingleTapTimer()
      if (seekHintTimerRef.current) {
        clearTimeout(seekHintTimerRef.current)
      }
    }
  }, [clearSingleTapTimer])

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => {
      const value = playerRef.current?.getCurrentTime?.()
      return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0
    },
    seekTo: (seconds: number, options?: { loopFromMoment?: boolean }) => {
      stopSegmentPlayback()
      if (options?.loopFromMoment) {
        momentLoopStartRef.current = seconds
      } else {
        clearMomentLoop()
      }
      if (!playerRef.current || !readyRef.current) return
      playerRef.current.seekTo(seconds, true)
      playerRef.current.playVideo()
    },
    playSegment: (
      startSeconds: number,
      durationSeconds: number,
      options?: { loopRepeats?: number; onEnd?: () => void },
    ) => {
      stopSegmentPlayback()
      if (!playerRef.current || !readyRef.current) return

      segmentStartRef.current = startSeconds
      segmentDurationRef.current = durationSeconds
      segmentLoopsRemainingRef.current = options?.loopRepeats ?? 0
      segmentOnEndRef.current = options?.onEnd ?? null
      runSegmentPlayback()
    },
    cancelSegmentPlayback: () => {
      stopSegmentPlayback()
    },
    stopMomentSequence: () => {
      stopSegmentPlayback()
    },
  }))

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === shellRef.current)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    return () => {
      stopSegmentPlayback()
    }
  }, [stopSegmentPlayback])

  useEffect(() => {
    if (!playerRef.current || !readyRef.current) return
    playerRef.current.setPlaybackRate(playbackRate)
  }, [playbackRate, mountKey])

  const loadVideo = (rawId: string | null, startSeconds: number | null = null) => {
    const id = normalizeYouTubeVideoId(rawId)
    if (!id) {
      setPlayerError('ID de vídeo inválido')
      return
    }

    setPlayerError(null)
    pendingVideoRef.current = id
    pendingStartRef.current = startSeconds

    if (!playerRef.current || !readyRef.current) return

    const current = playerRef.current.getVideoData()?.video_id
    if (current === id && startSeconds == null) return

    clearSegmentWatch()
    segmentActiveRef.current = false
    segmentLoopsRemainingRef.current = 0
    segmentOnEndRef.current = null
    clearMomentLoop()

    if (startSeconds != null && startSeconds >= 0) {
      playerRef.current.loadVideoById({ videoId: id, startSeconds })
      return
    }

    playerRef.current.loadVideoById(id)
  }

  useEffect(() => {
    let cancelled = false

    loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current) return

      const element = containerRef.current
      element.innerHTML = ''

      playerRef.current = new window.YT.Player(element, {
        height: '100%',
        width: '100%',
        playerVars: {
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          fs: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            readyRef.current = true
            event.target.setPlaybackRate(playbackRate)
            if (pendingVideoRef.current) {
              const start = pendingStartRef.current
              if (start != null && start >= 0) {
                event.target.loadVideoById({
                  videoId: pendingVideoRef.current,
                  startSeconds: start,
                })
              } else {
                event.target.loadVideoById(pendingVideoRef.current)
              }
            }
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              const current = event.target.getVideoData().video_id
              if (isValidYouTubeVideoId(current)) onVideoChange?.(current)
            }

            if (event.data === window.YT.PlayerState.ENDED) {
              if (segmentActiveRef.current) {
                handleSegmentEndRef.current()
                return
              }

              if (momentLoopStartRef.current != null) {
                event.target.seekTo(momentLoopStartRef.current, true)
                event.target.playVideo()
              }
            }
          },
          onError: (event) => {
            const messages: Record<number, string> = {
              2: 'ID de vídeo inválido',
              5: 'Erro no player HTML5',
              100: 'Vídeo não encontrado ou privado',
              101: 'Embed não permitido pelo dono',
              150: 'Embed não permitido pelo dono',
            }
            setPlayerError(messages[event.data] ?? `Erro no player (${event.data})`)
          },
        },
      })
    })

    return () => {
      cancelled = true
      readyRef.current = false
      playerRef.current?.destroy()
      playerRef.current = null
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [mountKey, onVideoChange, playbackRate])

  useEffect(() => {
    loadVideo(videoId, startAtSeconds)
  }, [videoId, startAtSeconds])

  const handleFullscreen = async () => {
    const shell = shellRef.current
    if (!shell) return

    try {
      if (document.fullscreenElement === shell) {
        await document.exitFullscreen()
      } else {
        await shell.requestFullscreen()
      }
    } catch {
      // Alguns browsers bloqueiam fullscreen fora de gesto do usuário.
    }
  }

  const handleRetry = () => {
    readyRef.current = false
    playerRef.current = null
    setMountKey((value) => value + 1)
    loadVideo(videoId, startAtSeconds)
  }

  return (
    <div
      ref={shellRef}
      className={`sticky top-0 z-20 flex w-full flex-col bg-black md:static md:z-auto md:min-h-0 md:flex-1 ${
        isFullscreen ? 'h-screen justify-center' : ''
      } ${className}`}
      data-testid="video-player"
    >
      <div
        className={`relative w-full bg-black ${
          isFullscreen ? 'flex min-h-0 flex-1 flex-col' : 'aspect-video'
        }`}
      >
        <div
          ref={containerRef}
          id="player"
          className={`w-full [&_iframe]:pointer-events-none ${
            isFullscreen ? 'min-h-0 flex-1' : 'h-full'
          }`}
        />

        {!playerError && (
          <div
            ref={tapOverlayRef}
            data-testid="video-tap-overlay"
            className="absolute inset-0 z-10 touch-manipulation"
            onPointerUp={handleTapOverlay}
            onDoubleClick={handleDoubleClick}
            aria-hidden
          />
        )}

        {seekHint && (
          <div
            data-testid="video-seek-hint"
            className={`pointer-events-none absolute top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/75 px-4 py-2 text-lg font-semibold text-white ${
              seekHintSide === 'right' ? 'right-8' : 'left-8'
            }`}
          >
            {seekHint}
          </div>
        )}

        {playerError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 p-4 text-center text-sm text-white">
            <p>{playerError}</p>
            <button
              type="button"
              className="rounded-lg bg-yellow-400 px-4 py-2 text-base font-medium text-slate-900"
              onClick={handleRetry}
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>

      <div className="bg-black" data-testid="video-player-controls">
        <div className="border-t border-slate-800 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {onMarkMoment && (
              <button
                type="button"
                data-testid="mark-moment-button"
                disabled={markingDisabled || !videoId}
                onClick={onMarkMoment}
                className="rounded-lg bg-yellow-400 px-4 py-2 text-base font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Marcar momento
              </button>
            )}

            <button
              type="button"
              data-testid="fullscreen-button"
              className="ml-auto rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-base font-medium text-white"
              onClick={handleFullscreen}
            >
              {isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            </button>
          </div>

          {toolbarExtra && (
            <div className="mt-3 border-t border-slate-800 pt-3">{toolbarExtra}</div>
          )}
        </div>
      </div>
    </div>
  )
})
