import { describe, expect, it } from 'vitest'
import { formatJson, minifyJson, parseJson, validateJson } from './json'

describe('JSON utilities', () => {
  it('formats nested objects and arrays with two-space indentation', () => {
    expect(formatJson('{"user":{"name":"Asha","roles":["admin","editor"]}}')).toBe(
      '{\n  "user": {\n    "name": "Asha",\n    "roles": [\n      "admin",\n      "editor"\n    ]\n  }\n}',
    )
  })

  it('minifies valid JSON while preserving values and data types', () => {
    const input = '{ "items": [1, 2.5, true, false, null, "text", {"key":"value"}] }'
    const output = minifyJson(input)

    expect(output).toBe('{"items":[1,2.5,true,false,null,"text",{"key":"value"}]}')
    expect(JSON.parse(output)).toEqual(JSON.parse(input))
    expect(typeof parseJson(output)).toBe('object')
  })

  it('accepts all JSON top-level value kinds', () => {
    expect(parseJson('[{}, [], true, false, null, 12, "hello"]')).toEqual([{}, [], true, false, null, 12, 'hello'])
    expect(formatJson('null')).toBe('null')
    expect(minifyJson('"a string"')).toBe('"a string"')
  })

  it('rejects malformed and empty JSON without transforming it', () => {
    for (const input of ['{bad', '']) {
      expect(() => formatJson(input)).toThrow()
      expect(() => minifyJson(input)).toThrow()
      expect(validateJson(input).valid).toBe(false)
    }
  })

  it('returns actionable validation details and coordinates when available', () => {
    const result = validateJson('{\n  "name": 1,\n}')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.message).toMatch(/Invalid JSON/)
      expect(result.line).toBe(3)
      expect(result.column).toBeGreaterThan(0)
    }
  })
})
