import { memo } from 'react'
import type { CSSProperties, KeyboardEvent, MutableRefObject } from 'react'
import { appendJsonPath, describePrimitive, type JsonValue } from './jsonTree'

const MAX_DEPTH = 100
const MAX_CHILDREN = 500

type JsonTreeNodeProps = {
  value: JsonValue
  name: string | number
  path: string
  depth: number
  expandedPaths: Set<string>
  selectedPath: string | null
  matchingPaths: Set<string>
  treeRef: MutableRefObject<HTMLDivElement | null>
  onToggle: (path: string) => void
  onSelect: (path: string) => void
}

function typeOf(value: JsonValue) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value === 'object' ? 'object' : typeof value
}

const JsonTreeNode = memo(function JsonTreeNode({ value, name, path, depth, expandedPaths, selectedPath, matchingPaths, treeRef, onToggle, onSelect }: JsonTreeNodeProps) {
  const type = typeOf(value)
  const isContainer = type === 'array' || type === 'object'
  const objectValue = isContainer && !Array.isArray(value) ? value as { [key: string]: JsonValue } : null
  const objectKeys = objectValue ? Object.keys(objectValue) : []
  const entryCount = Array.isArray(value) ? value.length : objectKeys.length
  const entries: Array<[string | number, JsonValue]> = Array.isArray(value)
    ? value.slice(0, MAX_CHILDREN + 1).map((child, index) => [index, child])
    : isContainer
      ? objectKeys.slice(0, MAX_CHILDREN + 1).map((key) => [key, objectValue![key]])
      : []
  const expanded = expandedPaths.has(path)
  const atDepthLimit = depth >= MAX_DEPTH && entryCount > 0
  const hasChildren = entryCount > 0 && !atDepthLimit
  const children = entries.slice(0, MAX_CHILDREN)
  const preview = type === 'array' ? `Array · ${entryCount}` : type === 'object' ? `Object · ${entryCount}` : describePrimitive(value as null | boolean | number | string)
  const rowClasses = [
    'tree-row',
    selectedPath === path ? 'tree-row-selected' : '',
    matchingPaths.has(path) ? 'tree-row-match' : '',
  ].filter(Boolean).join(' ')

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const rows = Array.from(treeRef.current?.querySelectorAll<HTMLButtonElement>('.tree-row-button') ?? [])
    const currentIndex = rows.indexOf(event.currentTarget)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      rows[currentIndex + (event.key === 'ArrowDown' ? 1 : -1)]?.focus()
    } else if (event.key === 'ArrowRight' && hasChildren) {
      event.preventDefault()
      if (!expanded) onToggle(path)
      else rows[currentIndex + 1]?.focus()
    } else if (event.key === 'ArrowLeft') {
      if (expanded && hasChildren) {
        event.preventDefault()
        onToggle(path)
      } else {
        const parent = event.currentTarget.closest('[role="treeitem"]')?.parentElement?.closest('[role="treeitem"]')
        const parentRow = parent?.querySelector<HTMLButtonElement>('.tree-row-button')
        if (parentRow) {
          event.preventDefault()
          parentRow.focus()
        }
      }
    }
  }

  return (
    <div className="tree-node" role="treeitem" aria-expanded={isContainer && hasChildren ? expanded : undefined} aria-selected={selectedPath === path}>
      <div className={rowClasses} style={{ '--tree-depth': depth } as CSSProperties}>
        {isContainer ? (
          <button
            type="button"
            className="tree-toggle"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${String(name)}`}
            aria-expanded={hasChildren ? expanded : undefined}
            disabled={!hasChildren}
            onClick={() => hasChildren && onToggle(path)}
            tabIndex={-1}
          >{hasChildren ? (expanded ? '⌄' : '›') : '·'}</button>
        ) : <span className="tree-toggle-spacer" aria-hidden="true" />}
        <button type="button" className="tree-row-button" onClick={() => onSelect(path)} onKeyDown={handleKeyDown}>
          <span className={`tree-name tree-${type}`}>{typeof name === 'number' ? `[${name}]` : name}</span>
          <span className={`tree-preview tree-preview-${type}`}>{preview}</span>
        </button>
      </div>
      {atDepthLimit && <div className="tree-limit" style={{ '--tree-depth': depth + 1 } as CSSProperties}>Depth limit reached (100 levels).</div>}
      {isContainer && expanded && hasChildren && (
        <div role="group" className="tree-children">
          {children.map(([childKey, childValue]) => {
            const childPath = appendJsonPath(path, childKey)
            return <JsonTreeNode
              key={childPath}
              value={childValue}
              name={childKey}
              path={childPath}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              matchingPaths={matchingPaths}
              treeRef={treeRef}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          })}
          {entryCount > MAX_CHILDREN && <div className="tree-limit" style={{ '--tree-depth': depth + 1 } as CSSProperties}>{entryCount - MAX_CHILDREN} more children hidden for performance.</div>}
        </div>
      )}
    </div>
  )
})

export default JsonTreeNode
