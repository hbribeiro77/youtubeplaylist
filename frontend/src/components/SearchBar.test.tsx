import { fireEvent, render, screen, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SearchBar } from './SearchBar'

describe('SearchBar', () => {
  it('debounces search callback', () => {
    vi.useFakeTimers()
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} />)

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'kubernetes' } })

    expect(onSearch).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(onSearch).toHaveBeenCalledWith('kubernetes')
    vi.useRealTimers()
  })
})
