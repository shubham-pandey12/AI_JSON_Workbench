import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import Button from '../../components/ui/Button'
import InlineMessage from '../../components/ui/InlineMessage'
import Panel from '../../components/ui/Panel'
import { parseJson } from '../../utils/json'
import ExplorerSearch from './ExplorerSearch'
import JsonTreeNode from './JsonTreeNode'
import { searchJson, type JsonValue } from './jsonTree'

type ParsedDocument = { data: JsonValue | undefined; error: string | null }

function parseDocument(source: string): ParsedDocument {
  if (!source.trim()) return { data: undefined, error: null }
  try {
    return { data: parseJson(source) as JsonValue, error: null }
  } catch (error) {
    return { data: undefined, error: error instanceof Error ? error.message : 'This JSON could not be parsed.' }
  }
}

export default function JsonExplorer({ source }: { source: string }) {
  const parsed = useMemo(() => parseDocument(source), [source])
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [currentMatch, setCurrentMatch] = useState(0)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(['$']))
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const treeRef = useRef<HTMLDivElement>(null)

  const searchResult = useMemo(() => parsed.data === undefined
    ? { matches: [], truncated: false }
    : searchJson(parsed.data, deferredQuery), [parsed.data, deferredQuery])
  const matchingPaths = useMemo(() => new Set(searchResult.matches.map((match) => match.path)), [searchResult.matches])
  const matchIndex = searchResult.matches.length ? currentMatch % searchResult.matches.length : 0
  const activeMatch = searchResult.matches[matchIndex]

  useEffect(() => {
    setSelectedPath(null)
    setExpandedPaths(new Set(['$']))
    setCurrentMatch(0)
    setCopyMessage(null)
  }, [source])

  useEffect(() => {
    if (!activeMatch) return
    setExpandedPaths((previous) => {
      const next = new Set(previous)
      let changed = false
      activeMatch.ancestors.forEach((path) => {
        if (!next.has(path)) { next.add(path); changed = true }
      })
      return changed ? next : previous
    })
    setSelectedPath(activeMatch.path)
  }, [activeMatch])

  const togglePath = useCallback((path: string) => {
    setExpandedPaths((previous) => {
      const next = new Set(previous)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const selectPath = useCallback((path: string) => {
    setSelectedPath(path)
    setCopyMessage(null)
  }, [])

  function moveMatch(direction: -1 | 1) {
    const total = searchResult.matches.length
    if (!total) return
    setCurrentMatch((current) => (current + direction + total) % total)
  }

  async function copyPath() {
    if (!selectedPath) return
    try {
      await navigator.clipboard.writeText(selectedPath)
      setCopyMessage('Path copied to the clipboard.')
    } catch {
      setCopyMessage('Clipboard access failed. Select and copy the path manually.')
    }
  }

  return (
    <Panel className="explorer-panel">
      <div className="explorer-heading">
        <div><p className="eyebrow">Structure</p><h3>Tree explorer</h3></div>
        {parsed.data !== undefined && <span className="explorer-type">JSON</span>}
      </div>
      <ExplorerSearch
        query={query}
        onQueryChange={(nextQuery) => { setQuery(nextQuery); setCurrentMatch(0) }}
        count={searchResult.matches.length}
        current={searchResult.matches.length ? matchIndex + 1 : 0}
        onPrevious={() => moveMatch(-1)}
        onNext={() => moveMatch(1)}
        disabled={parsed.data === undefined}
      />
      <div className="tree-scroll-region">
        {parsed.error ? (
          <div className="explorer-empty explorer-invalid"><span className="empty-icon" aria-hidden="true">!</span><strong>Invalid JSON</strong><p>{parsed.error}</p></div>
        ) : parsed.data === undefined ? (
          <div className="explorer-empty"><span className="empty-icon" aria-hidden="true">{`{ }`}</span><strong>No JSON to explore</strong><p>Enter a JSON value in the editor to see its structure here.</p></div>
        ) : (
          <div className="json-tree" role="tree" aria-label="JSON structure" ref={treeRef}>
            <JsonTreeNode
              value={parsed.data}
              name="$"
              path="$"
              depth={0}
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              matchingPaths={matchingPaths}
              treeRef={treeRef}
              onToggle={togglePath}
              onSelect={selectPath}
            />
            {searchResult.truncated && <p className="tree-limit-note">Search stopped at the safety limit. Narrow your query to see more matches.</p>}
            {deferredQuery && searchResult.matches.length === 0 && <p className="no-search-matches">No matches found for “{deferredQuery}”.</p>}
          </div>
        )}
      </div>
      <div className="selected-path-row">
        <div className="selected-path-content"><span>Selected path</span><code title={selectedPath ?? ''}>{selectedPath ?? 'Select a node to view its path'}</code></div>
        <Button onClick={() => void copyPath()} disabled={!selectedPath} aria-label="Copy selected JSON path">Copy path</Button>
      </div>
      {copyMessage && <InlineMessage tone={copyMessage.startsWith('Path copied') ? 'success' : 'error'}>{copyMessage}</InlineMessage>}
    </Panel>
  )
}
