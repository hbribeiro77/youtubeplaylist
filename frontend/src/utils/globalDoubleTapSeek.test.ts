import { describe, expect, it } from 'vitest'
import {
  clampSeekPosition,
  formatDoubleTapSeekHint,
  getDoubleTapSeekDelta,
  getDoubleTapSeekDirection,
} from './globalDoubleTapSeek'

describe('globalDoubleTapSeek', () => {
  it('detects forward taps on the right half', () => {
    expect(getDoubleTapSeekDirection(700, 1000)).toBe('forward')
    expect(getDoubleTapSeekDirection(300, 1000)).toBe('backward')
  })

  it('builds seek delta from direction and configured seconds', () => {
    expect(getDoubleTapSeekDelta('forward', 5)).toBe(5)
    expect(getDoubleTapSeekDelta('backward', 2)).toBe(-2)
  })

  it('clamps seek position inside video duration', () => {
    expect(clampSeekPosition(98, 100, 5)).toBe(99.9)
    expect(clampSeekPosition(1, 100, -5)).toBe(0)
  })

  it('formats seek hint labels', () => {
    expect(formatDoubleTapSeekHint(5)).toBe('+5s')
    expect(formatDoubleTapSeekHint(-2)).toBe('-2s')
  })
})
