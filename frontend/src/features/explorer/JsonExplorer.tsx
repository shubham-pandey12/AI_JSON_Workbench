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
