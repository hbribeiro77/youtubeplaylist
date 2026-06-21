const SEGMENT_END_EPSILON_SECONDS = 0.1

export function hasSegmentReachedEnd(
  currentTimeSeconds: number,
  startSeconds: number,
  durationSeconds: number,
): boolean {
  return currentTimeSeconds >= startSeconds + durationSeconds - SEGMENT_END_EPSILON_SECONDS
}

export function segmentEndTimeSeconds(startSeconds: number, durationSeconds: number): number {
  return startSeconds + durationSeconds
}
