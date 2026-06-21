export const PLAYBACK_RATES = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const

export type PlaybackRate = (typeof PLAYBACK_RATES)[number]

const STORAGE_KEY = 'youtubeplaylist.playbackRate'

export function loadGlobalPlaybackRate(): PlaybackRate {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return 1
    const value = Number(raw)
    return (PLAYBACK_RATES as readonly number[]).includes(value) ? (value as PlaybackRate) : 1
  } catch {
    return 1
  }
}

export function saveGlobalPlaybackRate(rate: PlaybackRate): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(rate))
  } catch {
    // localStorage indisponível (modo privado, etc.)
  }
}

export function formatPlaybackRate(rate: number): string {
  if (rate === 0.1) return '0.10x'
  return `${rate}x`
}
