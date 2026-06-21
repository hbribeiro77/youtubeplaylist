import { describe, expect, it } from 'vitest'
import { isValidYouTubeVideoId, normalizeYouTubeVideoId } from './youtubeVideoId'

describe('youtubeVideoId', () => {
  it('accepts valid ids', () => {
    expect(isValidYouTubeVideoId('dQw4w9WgXcQ')).toBe(true)
    expect(isValidYouTubeVideoId('6Y4mgeGf2xQ')).toBe(true)
  })

  it('rejects invalid ids', () => {
    expect(isValidYouTubeVideoId('abc')).toBe(false)
    expect(isValidYouTubeVideoId('')).toBe(false)
  })

  it('normalizes trimmed ids', () => {
    expect(normalizeYouTubeVideoId(' 6Y4mgeGf2xQ ')).toBe('6Y4mgeGf2xQ')
    expect(normalizeYouTubeVideoId('invalid')).toBeNull()
  })
})
