import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { isValidYouTubeVideoId, normalizeYouTubeVideoId } from '../utils/youtubeVideoId'

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
    options?: { loop?: boolean; onEnd?: () => void },
  ) => void
  cancelSegmentPlayback: () => void
  stopMomentSequence: () => void
}

interface VideoPlayerProps {
  videoId: string | null
  startAtSeconds?: number | null
  playbackRate?: number
  onVideoChange?: (videoId: string) => void
  onMarkMoment?: () => void
  markingDisabled?: boolean
  toolbarExtra?: ReactNode
  className?: string
}

let apiReadyPromise: Promise<void> | null = null
const CONTROLS_AUTO_HIDE_MS = 3000

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
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const segmentLoopRef = useRef(false)
  const segmentOnEndRef = useRef<(() => void) | null>(null)
  const segmentStartRef = useRef(0)
  const segmentDurationRef = useRef(0)
  const momentLoopStartRef = useRef<number | null>(null)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [mountKey, setMountKey] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)

  const clearHideControlsTimer = useCallback(() => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current)
      hideControlsTimerRef.current = null
    }
  }, [])

  const clearSegmentTimer = useCallback(() => {
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current)
      segmentTimerRef.current = null
    }
  }, [])

  const clearMomentLoop = useCallback(() => {
    momentLoopStartRef.current = null
  }, [])

  const scheduleHideControls = useCallback(() => {
    clearHideControlsTimer()
    hideControlsTimerRef.current = setTimeout(() => {
      setControlsVisible(false)
    }, CONTROLS_AUTO_HIDE_MS)
  }, [clearHideControlsTimer])

  const showControls = useCallback(
    (autoHide = true) => {
      setControlsVisible(true)
      if (autoHide && isPlaying) {
        scheduleHideControls()
      } else {
        clearHideControlsTimer()
      }
    },
    [clearHideControlsTimer, isPlaying, scheduleHideControls],
  )

  const toggleControls = useCallback(() => {
    setControlsVisible((visible) => {
      const next = !visible
      if (next) {
        if (isPlaying) scheduleHideControls()
      } else {
        clearHideControlsTimer()
      }
      return next
    })
  }, [clearHideControlsTimer, isPlaying, scheduleHideControls])

  const runSegmentPlayback = useCallback(() => {
    if (!playerRef.current || !readyRef.current) return

    playerRef.current.seekTo(segmentStartRef.current, true)
    playerRef.current.playVideo()
    setControlsVisible(true)

    clearSegmentTimer()
    segmentTimerRef.current = setTimeout(() => {
      if (segmentLoopRef.current) {
        runSegmentPlayback()
        return
      }

      playerRef.current?.pauseVideo()
      setIsPlaying(false)
      setControlsVisible(true)

      const onEnd = segmentOnEndRef.current
      segmentOnEndRef.current = null
      onEnd?.()
    }, segmentDurationRef.current * 1000)
  }, [clearSegmentTimer])

  const stopSegmentPlayback = useCallback(() => {
    clearSegmentTimer()
    segmentLoopRef.current = false
    segmentOnEndRef.current = null
    clearMomentLoop()
  }, [clearMomentLoop, clearSegmentTimer])

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
      showControls(true)
    },
    playSegment: (
      startSeconds: number,
      durationSeconds: number,
      options?: { loop?: boolean; onEnd?: () => void },
    ) => {
      stopSegmentPlayback()
      if (!playerRef.current || !readyRef.current) return

      segmentStartRef.current = startSeconds
      segmentDurationRef.current = durationSeconds
      segmentLoopRef.current = options?.loop ?? false
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
      clearHideControlsTimer()
      stopSegmentPlayback()
    }
  }, [clearHideControlsTimer, stopSegmentPlayback])

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

    clearSegmentTimer()
    segmentLoopRef.current = false
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
            const playing = event.data === window.YT.PlayerState.PLAYING
            const paused = event.data === window.YT.PlayerState.PAUSED

            if (playing) {
              setIsPlaying(true)
              const current = event.target.getVideoData().video_id
              if (isValidYouTubeVideoId(current)) onVideoChange?.(current)
              scheduleHideControls()
            }

            if (paused) {
              setIsPlaying(false)
              clearHideControlsTimer()
              setControlsVisible(true)
            }

            if (event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false)
              clearHideControlsTimer()
              setControlsVisible(true)

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
  }, [mountKey, onVideoChange, clearHideControlsTimer, scheduleHideControls])

  useEffect(() => {
    loadVideo(videoId, startAtSeconds)
  }, [videoId, startAtSeconds])

  const handleFullscreen = async () => {
    const shell = shellRef.current
    if (!shell) return

    showControls(false)

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
        onClick={toggleControls}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            toggleControls()
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={controlsVisible ? 'Ocultar controles' : 'Mostrar controles'}
      >
        <div
          ref={containerRef}
          id="player"
          className={`w-full ${isFullscreen ? 'min-h-0 flex-1' : 'h-full'}`}
        />

        {playerError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 p-4 text-center text-sm text-white">
            <p>{playerError}</p>
            <button
              type="button"
              className="rounded-lg bg-yellow-400 px-4 py-2 text-base font-medium text-slate-900"
              onClick={(event) => {
                event.stopPropagation()
                handleRetry()
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!controlsVisible && !playerError && (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
            <span className="rounded-full bg-black/70 px-3 py-1 text-xs text-slate-200">
              Toque para mostrar controles
            </span>
          </div>
        )}
      </div>

      <div
        className={`overflow-hidden bg-black transition-all duration-300 ease-out ${
          controlsVisible ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}
        data-testid="video-player-controls"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
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
            <div className="mt-3 border-t border-slate-800 pt-3">
              {toolbarExtra}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
