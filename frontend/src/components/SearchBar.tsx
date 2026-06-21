import { useEffect, useState } from 'react'

interface SearchBarProps {
  onSearch: (query: string) => void
  placeholder?: string
}

export function SearchBar({ onSearch, placeholder = 'Buscar por título, descrição, tags ou transcrição...' }: SearchBarProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => onSearch(value), 300)
    return () => window.clearTimeout(timer)
  }, [value, onSearch])

  return (
    <div className="px-3 py-2">
      <input
        type="search"
        data-testid="search-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-yellow-400 focus:outline-none"
      />
    </div>
  )
}
