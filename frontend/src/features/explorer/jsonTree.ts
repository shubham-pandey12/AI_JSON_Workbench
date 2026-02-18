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
    const primitiveText = node.value === null ? 'null' : String(node.value)
    const valueMatches = isPrimitive && primitiveText.toLocaleLowerCase().includes(normalizedQuery)
    if (keyMatches || valueMatches) matches.push({ path: node.path, ancestors: node.ancestors })

    if (node.depth >= maxDepth) {
      if (node.value !== null && typeof node.value === 'object' && Object.keys(node.value).length > 0) truncated = true
      continue
    }

    const arrayValue = Array.isArray(node.value) ? node.value : null
    const objectValue = node.value !== null && typeof node.value === 'object' && !arrayValue
      ? node.value
      : null
    const objectKeys = objectValue ? Object.keys(objectValue) : []
    const childCount = arrayValue ? arrayValue.length : objectKeys.length
    const availableSlots = Math.max(0, maxNodes - visited - stack.length)
    const visitCount = Math.min(childCount, availableSlots)
    if (visitCount < childCount) truncated = true

    for (let index = visitCount - 1; index >= 0; index -= 1) {
      const key = arrayValue ? index : objectKeys[index]
      const value = arrayValue
        ? arrayValue[index]
        : (objectValue as { [key: string]: JsonValue })[key as string]
      stack.push({
        value,
        key,
        path: appendJsonPath(node.path, key),
        ancestors: [...node.ancestors, node.path],
        depth: node.depth + 1,
      })
    }
  }

  return { matches, truncated }
}

export function describePrimitive(value: null | boolean | number | string): string {
  return typeof value === 'string' ? JSON.stringify(value) : String(value)
}
