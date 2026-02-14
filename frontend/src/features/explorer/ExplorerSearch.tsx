import Button from '../../components/ui/Button'

type ExplorerSearchProps = {
  query: string
  onQueryChange: (query: string) => void
  count: number
  current: number
  onPrevious: () => void
  onNext: () => void
  disabled?: boolean
}

export default function ExplorerSearch({ query, onQueryChange, count, current, onPrevious, onNext, disabled = false }: ExplorerSearchProps) {
  return (
    <div className="explorer-search">
      <label className="search-field">
        <span aria-hidden="true" className="search-glyph">⌕</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search keys and values"
          aria-label="Search JSON keys and values"
          disabled={disabled}
        />
        {query && <span className="search-count" aria-live="polite">{count ? `${current} of ${count}` : '0 matches'}</span>}
      </label>
      <div className="search-navigation">
        <Button aria-label="Previous search match" onClick={onPrevious} disabled={disabled || count === 0}>↑</Button>
        <Button aria-label="Next search match" onClick={onNext} disabled={disabled || count === 0}>↓</Button>
      </div>
    </div>
  )
}
