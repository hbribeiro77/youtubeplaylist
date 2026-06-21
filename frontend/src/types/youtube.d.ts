declare namespace YT {
  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }

  interface PlayerOptions {
    height?: string | number
    width?: string | number
    videoId?: string
    playerVars?: Record<string, string | number>
    events?: {
      onReady?: (event: { target: Player }) => void
      onStateChange?: (event: { data: number; target: Player }) => void
      onError?: (event: { data: number; target: Player }) => void
    }
  }

  class Player {
    constructor(element: HTMLElement | string, options: PlayerOptions)
    loadVideoById(videoId: string): void
    setPlaybackRate(rate: number): void
    getVideoData(): { video_id: string }
    destroy(): void
  }
}
