import type { JsonValidation } from '../types/json'

export function parseJson(source: string): unknown {
  if (source.trim() === '') {
    throw new Error('JSON input is empty. Add a JSON value or upload a file.')
  }
  return JSON.parse(source) as unknown
}

function errorPosition(message: string): number | undefined {
  const match = message.match(/(?:at\s+)?position\s+(\d+)/i)
  return match ? Number(match[1]) : undefined
}

function lineAndColumn(source: string, position: number) {
  const lines = source.slice(0, position).split('\n')
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 }
}

export function validateJson(source: string): JsonValidation {
  try {
    parseJson(source)
    return { valid: true }
  } catch (error) {
    if (!(error instanceof SyntaxError)) return { valid: false, message: (error as Error).message }
    const position = errorPosition(error.message)
    const coordinates = position === undefined ? undefined : lineAndColumn(source, position)
    const location = coordinates
      ? ` (line ${coordinates.line}, column ${coordinates.column})`
      : ''
    return { valid: false, ...coordinates, message: `Invalid JSON${location}. ${error.message}` }
  }
}

export function formatJson(source: string): string {
  return JSON.stringify(parseJson(source), null, 2)
}

export function minifyJson(source: string): string {
  return JSON.stringify(parseJson(source))
}
