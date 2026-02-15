import { describe, expect, it } from 'vitest'
import { appendJsonPath, describePrimitive, searchJson, type JsonValue } from './jsonTree'

describe('JSON tree helpers', () => {
  it('builds dot paths for identifier keys and bracket paths for special keys', () => {
    expect(appendJsonPath('$.users[0]', 'email')).toBe('$.users[0].email')
    expect(appendJsonPath('$', 'has space')).toBe('$["has space"]')
    expect(appendJsonPath('$', 'a.b')).toBe('$["a.b"]')
    expect(appendJsonPath('$', 'a"b')).toBe('$["a\\"b"]')
    expect(appendJsonPath('$.items', 3)).toBe('$.items[3]')
  })

  it('searches nested objects and arrays by keys and primitive values, ignoring case', () => {
    const json: JsonValue = { users: [{ email: 'Ada@Example.com', active: true }, { email: 'Lin@example.com', active: false }] }
    const byKey = searchJson(json, 'EMAIL')
    const byValue = searchJson(json, 'ada@example')

    expect(byKey.matches.map(({ path }) => path)).toEqual(['$.users[0].email', '$.users[1].email'])
    expect(byValue.matches.map(({ path }) => path)).toEqual(['$.users[0].email'])
    expect(byKey.matches[0].ancestors).toEqual(['$', '$.users', '$.users[0]'])
  })

  it('handles empty containers and each primitive type', () => {
    const json: JsonValue = { emptyObject: {}, emptyArray: [], count: 0, yes: true, no: false, nothing: null, title: 'JSON' }
    expect(searchJson(json, 'empty').matches.map(({ path }) => path)).toEqual(['$.emptyObject', '$.emptyArray'])
    expect(searchJson(json, 'null').matches.map(({ path }) => path)).toEqual(['$.nothing'])
    expect(describePrimitive(null)).toBe('null')
    expect(describePrimitive(false)).toBe('false')
    expect(describePrimitive(0)).toBe('0')
    expect(describePrimitive('a"b')).toBe('"a\\"b"')
  })

  it('returns no matches for a blank query and caps deep or broad searches', () => {
    const json: JsonValue = { many: Array.from({ length: 20 }, (_, index) => index) }
    expect(searchJson(json, ' ').matches).toEqual([])
    expect(searchJson(json, '1', { maxNodes: 5 }).truncated).toBe(true)
    expect(searchJson(json, '1', { maxDepth: 0 }).truncated).toBe(true)
  })
})
