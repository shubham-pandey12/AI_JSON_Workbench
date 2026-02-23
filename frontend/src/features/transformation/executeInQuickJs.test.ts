import { describe, expect, it } from 'vitest'
import { executeInQuickJs } from './executeInQuickJs'

describe('QuickJS transformation interpreter', () => {
  it('transforms nested JSON data and returns JSON text', async () => {
    const result = await executeInQuickJs(
      'function transform(input) { return input.users.filter((user) => user.active).map((user) => user.name); }',
      { users: [{ name: 'Ada', active: true }, { name: 'Lin', active: false }] },
    )
    expect(JSON.parse(result)).toEqual(['Ada'])
  })

  it('rejects invalid syntax and reports thrown runtime errors', async () => {
    await expect(executeInQuickJs('function transform(input) { return ;', {})).rejects.toThrow(/Code must be/)
    await expect(executeInQuickJs('function transform(input) { throw new Error("bad transform"); }', {})).rejects.toThrow(/bad transform/)
  })

  it('interrupts an infinite loop', async () => {
    await expect(executeInQuickJs('function transform(input) { while (true) {} }', {})).rejects.toThrow(/execution limit|interrupted/i)
  }, 10_000)

  it.each([
    ['undefined', 'function transform(input) { return undefined; }'],
    ['function', 'function transform(input) { return () => 1; }'],
    ['BigInt', 'function transform(input) { return 1n; }'],
    ['non-finite number', 'function transform(input) { return NaN; }'],
    ['cycle', 'function transform(input) { const result = {}; result.self = result; return result; }'],
    ['custom object', 'function transform(input) { return new Date(); }'],
    ['sparse array', 'function transform(input) { const result = []; result[1] = "x"; return result; }'],
  ])('rejects a non-JSON result containing %s', async (_label, code) => {
    await expect(executeInQuickJs(code, {})).rejects.toThrow()
  })

  it('rejects oversized output', async () => {
    await expect(executeInQuickJs('function transform(input) { return "x".repeat(600000); }', {})).rejects.toThrow(/512 KiB/)
  })
})
