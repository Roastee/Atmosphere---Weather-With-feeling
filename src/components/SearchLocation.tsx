import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Search, X } from 'lucide-react'
import openMeteoProvider from '../lib/api'
import type { Location } from '../types/api'

export function SearchLocation({ query, setQuery, onSelect }: { query: string; setQuery: (v: string) => void; onSelect: (v: Location) => void }) {
  const [results, setResults] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const sequence = useRef(0)

  useEffect(() => {
    const q = query.trim()
    const id = ++sequence.current
    setResults([])
    setError('')
    setLoading(false)
    if (q.length < 2) {
      setOpen(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(async () => {
      setOpen(true)
      try {
        const found = await openMeteoProvider.searchLocations(q, controller.signal)
        if (id === sequence.current && !controller.signal.aborted) setResults(found)
      } catch {
        if (id === sequence.current && !controller.signal.aborted) setError('Search unavailable. Please try again.')
      } finally {
        if (id === sequence.current && !controller.signal.aborted) setLoading(false)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  return <div className="search-wrap">
    <form className="search-box" onSubmit={event => event.preventDefault()}>
      <Search size={17} aria-hidden="true" />
      <input type="search" inputMode="search" name="location" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} onFocus={() => query.length >= 2 && setOpen(true)} placeholder="Search a city…" aria-label="Search a city" aria-controls="location-search-results" aria-expanded={open} />
      {query && <button type="button" className="clear-search" onClick={() => setQuery('')} aria-label="Clear search"><X size={14} aria-hidden="true" /></button>}
    </form>
    {open && <div id="location-search-results" className="search-results" role="listbox" aria-label="Location search results">
      {loading && <div className="search-state" role="status"><LoaderCircle className="spin" size={15} aria-hidden="true" /> Searching…</div>}
      {!loading && error && <div className="search-state error" role="alert">{error}</div>}
      {!loading && !error && !results.length && <div className="search-state">No locations found.</div>}
      {results.map(item => <button type="button" role="option" className="location-result" key={`${item.id}:${item.latitude}:${item.longitude}`} onClick={() => onSelect(item)}>
        <strong>{item.name}</strong>
        <span>{[item.admin1, item.country].filter(Boolean).join(', ')} ({item.country_code})</span>
        <small>{item.latitude.toFixed(3)}, {item.longitude.toFixed(3)} · {item.timezone}</small>
      </button>)}
    </div>}
  </div>
}
