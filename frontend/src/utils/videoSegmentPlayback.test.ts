import { describe, expect, it } from 'vitest'
import { hasSegmentReachedEnd, segmentEndTimeSeconds } from './videoSegmentPlayback'

describe('videoSegmentPlayback', () => {
  it('detects when video time reached segment end', () => {
    expect(hasSegmentReachedEnd(104.95, 100, 5)).toBe(true)
    expect(hasSegmentReachedEnd(104.5, 100, 5)).toBe(false)
  })

  it('computes segment end from start and duration in video seconds', () => {
    expect(segmentEndTimeSeconds(55, 8)).toBe(63)
  })
})
