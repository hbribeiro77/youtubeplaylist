import { useEffect, useRef, useState } from 'react'
import { isValidYouTubeVideoId, normalizeYouTubeVideoId } from '../utils/youtubeVideoId'

declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
  }
}

interface VideoPlayerProps {
  videoId: string | null
  onVideoChange?: (videoId: string) => void
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

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function VideoPlayer({ videoId, onVideoChange, className = '' }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const readyRef = useRef(false)
  const pendingVideoRef = useRef<string | null>(normalizeYouTubeVideoId(videoId))
  const [playbackRate, setPlaybackRate] = useState(1)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [mountKey, setMountKey] = useState(0)

  const loadVideo = (rawId: string | null) => {
    const id = normalizeYouTubeVideoId(rawId)
    if (!id) {
      setPlayerError('ID de vídeo inválido')
      return
    }

    setPlayerError(null)
    pendingVideoRef.current = id

    if (!playerRef.current || !readyRef.current) return

    const current = playerRef.current.getVideoData()?.video_id
    if (current === id) return

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
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            readyRef.current = true
            if (pendingVideoRef.current) {
              event.target.loadVideoById(pendingVideoRef.current)
            }
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              const current = event.target.getVideoData().video_id
              if (isValidYouTubeVideoId(current)) onVideoChange?.(current)
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
  }, [mountKey, onVideoChange])

  useEffect(() => {
    loadVideo(videoId)
  }, [videoId])

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate)
    playerRef.current?.setPlaybackRate(rate)
  }

  const handleFullscreen = () => {
    const iframe = containerRef.current?.querySelector('iframe')
    iframe?.requestFullscreen?.()
  }

  const handleRetry = () => {
    readyRef.current = false
    playerRef.current = null
    setMountKey((value) => value + 1)
    loadVideo(videoId)
  }

  return (
    <div
      className={`sticky top-0 z-20 bg-slate-950 md:static md:z-auto ${className}`}
      data-testid="video-player"
    >
      <div className="relative aspect-video w-full bg-black">
        <div ref={containerRef} id="player" className="h-full w-full" />
        {playerError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-4 text-center text-sm text-white">
            <p>{playerError}</p>
            <button
              type="button"
              className="rounded bg-yellow-400 px-3 py-1 text-slate-900"
              onClick={handleRetry}
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
        <label className="text-xs text-slate-300" htmlFor="playback-rate">
          Velocidade
        </label>
        <select
          id="playback-rate"
          data-testid="playback-rate"
          className="rounded bg-slate-800 px-2 py-1 text-sm"
          value={playbackRate}
          onChange={(e) => handleRateChange(Number(e.target.value))}
        >
          {PLAYBACK_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate}x
            </option>
          ))}
        </select>
        <button
          type="button"
          data-testid="fullscreen-button"
          className="ml-auto rounded bg-slate-800 px-3 py-1 text-sm"
          onClick={handleFullscreen}
        >
          Tela cheia
        </button>
      </div>
    </div>
  )
}
