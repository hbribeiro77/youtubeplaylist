import { describe, expect, it } from 'vitest'
import { formatDuration } from '../utils/formatDuration'

describe('formatDuration', () => {
  it('formats seconds as mm:ss', () => {
    expect(formatDuration(125)).toBe('2:05')
  })

  it('formats hours', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
  })
})
