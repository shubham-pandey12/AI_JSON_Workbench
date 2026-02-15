export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export type JsonSearchMatch = { path: string; ancestors: string[] }
export type JsonSearchResult = { matches: JsonSearchMatch[]; truncated: boolean }

const identifierKey = /^[A-Za-z_$][A-Za-z\d_$]*$/

export function appendJsonPath(path: string, key: string | number): string {
  if (typeof key === 'number') return `${path}[${key}]`
  return identifierKey.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`
}

export function searchJson(
  root: JsonValue,
  query: string,
  limits: { maxNodes?: number; maxDepth?: number } = {},
): JsonSearchResult {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return { matches: [], truncated: false }

  const maxNodes = limits.maxNodes ?? 50_000
  const maxDepth = limits.maxDepth ?? 200
  const stack: Array<{ value: JsonValue; key: string | number; path: string; ancestors: string[]; depth: number }> = [
    { value: root, key: '$', path: '$', ancestors: [], depth: 0 },
  ]
  const matches: JsonSearchMatch[] = []
  let visited = 0
  let truncated = false

  while (stack.length > 0) {
    if (visited >= maxNodes) {
      truncated = true
      break
    }
    const node = stack.pop()!
    visited += 1

    const keyMatches = typeof node.key === 'string' && node.key !== '$'
      && node.key.toLocaleLowerCase().includes(normalizedQuery)
    const isPrimitive = node.value === null || typeof node.value !== 'object'
