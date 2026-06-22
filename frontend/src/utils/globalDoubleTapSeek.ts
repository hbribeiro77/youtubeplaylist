export const DOUBLE_TAP_SEEK_OPTIONS = [1, 2, 5, 10, 15, 30] as const

export type DoubleTapSeekSeconds = (typeof DOUBLE_TAP_SEEK_OPTIONS)[number]

const STORAGE_KEY = 'youtubeplaylist.doubleTapSeekSeconds'
const DEFAULT_DOUBLE_TAP_SEEK_SECONDS: DoubleTapSeekSeconds = 10
const DOUBLE_TAP_WINDOW_MS = 320
const SINGLE_TAP_DELAY_MS = 280

export function loadGlobalDoubleTapSeekSeconds(): DoubleTapSeekSeconds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_DOUBLE_TAP_SEEK_SECONDS
    const value = Number(raw)
    return (DOUBLE_TAP_SEEK_OPTIONS as readonly number[]).includes(value)
      ? (value as DoubleTapSeekSeconds)
      : DEFAULT_DOUBLE_TAP_SEEK_SECONDS
  } catch {
    return DEFAULT_DOUBLE_TAP_SEEK_SECONDS
  }
}

export function saveGlobalDoubleTapSeekSeconds(seconds: DoubleTapSeekSeconds): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(seconds))
  } catch {
    // localStorage indisponível
  }
}

export function formatDoubleTapSeekHint(deltaSeconds: number): string {
  return deltaSeconds > 0 ? `+${deltaSeconds}s` : `${deltaSeconds}s`
}

export function getDoubleTapSeekDirection(
  tapX: number,
  areaWidth: number,
): 'forward' | 'backward' {
  return tapX > areaWidth / 2 ? 'forward' : 'backward'
}

export function getDoubleTapSeekDelta(
  direction: 'forward' | 'backward',
  seekSeconds: number,
): number {
  return direction === 'forward' ? seekSeconds : -seekSeconds
}

export function clampSeekPosition(current: number, duration: number, delta: number): number {
  const next = current + delta
  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, next)
  }
  return Math.max(0, Math.min(duration - 0.1, next))
}

export const doubleTapTiming = {
  doubleTapWindowMs: DOUBLE_TAP_WINDOW_MS,
  singleTapDelayMs: SINGLE_TAP_DELAY_MS,
}
