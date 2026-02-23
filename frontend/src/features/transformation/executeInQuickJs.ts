import RELEASE_SYNC from '@jitl/quickjs-wasmfile-release-sync'
import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten-core'
import { TRANSFORM_CODE_LIMIT, TRANSFORM_DEADLINE_MS, TRANSFORM_OUTPUT_LIMIT_BYTES } from './transformTypes'

const QUICKJS_MEMORY_LIMIT_BYTES = 8 * 1024 * 1024
const QUICKJS_STACK_LIMIT_BYTES = 512 * 1024

export async function executeInQuickJs(code: string, jsonData: unknown): Promise<string> {
  if (code.length > TRANSFORM_CODE_LIMIT || !/^function\s+transform\s*\(\s*input\s*\)\s*\{[\s\S]*}\s*$/.test(code)) {
    throw new Error('Code must be a function declaration named transform(input).')
  }
  const serializedInput = JSON.stringify(jsonData)
  if (serializedInput === undefined) throw new Error('The input is not JSON-compatible.')

  const QuickJS = await newQuickJSWASMModuleFromVariant(RELEASE_SYNC)
  const runtime = QuickJS.newRuntime()
  runtime.setMemoryLimit(QUICKJS_MEMORY_LIMIT_BYTES)
  runtime.setMaxStackSize(QUICKJS_STACK_LIMIT_BYTES)
  const context = runtime.newContext()
  try {
    const deadline = Date.now() + TRANSFORM_DEADLINE_MS
    runtime.setInterruptHandler(() => Date.now() >= deadline)
    const source = `
      const __originalObjectPrototype = Object.prototype;
      const __originalArrayPrototype = Array.prototype;
      const __isArray = Array.isArray;
      const __getPrototypeOf = Object.getPrototypeOf;
      const __ownKeys = Reflect.ownKeys;
      const __getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
      const __isFinite = Number.isFinite;
      const __isInteger = Number.isInteger;
      const __String = String;
      const __quote = JSON.stringify.bind(JSON);
      const __WeakSet = WeakSet;
      const __visited = new __WeakSet();
      const __weakSetAdd = __WeakSet.prototype.add.bind(__visited);
      const __weakSetDelete = __WeakSet.prototype.delete.bind(__visited);
      const __weakSetHas = __WeakSet.prototype.has.bind(__visited);
      const input = ${serializedInput};
      ${code}
      (() => {
        let nodeCount = 0;
        function encode(value, depth) {
          nodeCount += 1;
          if (nodeCount > 20000) throw new Error('Result contains too many values.');
          if (depth > 64) throw new Error('Result is nested too deeply.');
          if (value === null) return 'null';
          const kind = typeof value;
          if (kind === 'string') return __quote(value);
          if (kind === 'boolean') return value ? 'true' : 'false';
          if (kind === 'number') {
            if (!__isFinite(value)) throw new Error('Result contains a non-finite number.');
            return String(value);
          }
          if (kind !== 'object') throw new Error('Result contains a value that JSON cannot represent.');
          if (__weakSetHas(value)) throw new Error('Result contains a circular reference.');
          __weakSetAdd(value);
          let output;
          if (__isArray(value)) {
            if (__getPrototypeOf(value) !== __originalArrayPrototype) throw new Error('Result contains a custom object type.');
            const keys = __ownKeys(value);
            for (const key of keys) {
              if (typeof key !== 'string') throw new Error('Result contains a symbol key.');
              if (key === 'length') continue;
              const index = __String(key) === key ? key * 1 : NaN;
              if (!__isInteger(index) || index < 0 || index >= value.length || __String(index) !== key) {
                throw new Error('Result arrays cannot have named properties.');
              }
            }
            output = '[';
            for (let index = 0; index < value.length; index += 1) {
              const descriptor = __getOwnPropertyDescriptor(value, String(index));
              if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new Error('Result arrays cannot contain holes or accessors.');
              if (index) output += ',';
              output += encode(descriptor.value, depth + 1);
              if (output.length > ${TRANSFORM_OUTPUT_LIMIT_BYTES}) throw new Error('Result exceeds the 512 KiB output limit.');
            }
            output += ']';
          } else {
            const prototype = __getPrototypeOf(value);
            if (prototype !== __originalObjectPrototype && prototype !== null) throw new Error('Result contains a custom object type.');
            const keys = __ownKeys(value);
            output = '{';
            let fieldCount = 0;
            for (const key of keys) {
              if (typeof key !== 'string') throw new Error('Result contains a symbol key.');
              const descriptor = __getOwnPropertyDescriptor(value, key);
              if (!descriptor || !descriptor.enumerable) continue;
              if (!('value' in descriptor)) throw new Error('Result objects cannot contain accessors.');
              if (fieldCount++) output += ',';
              output += __quote(key) + ':' + encode(descriptor.value, depth + 1);
              if (output.length > ${TRANSFORM_OUTPUT_LIMIT_BYTES}) throw new Error('Result exceeds the 512 KiB output limit.');
            }
            output += '}';
          }
          __weakSetDelete(value);
          if (output.length > ${TRANSFORM_OUTPUT_LIMIT_BYTES}) throw new Error('Result exceeds the 512 KiB output limit.');
          return output;
        }
        return encode(transform(input), 0);
      })()
    `
    const result = context.evalCode(source, 'reviewed-transformation.js')
    if (result.error) {
      const dumped: unknown = context.dump(result.error)
      result.error.dispose()
      const errorObject = dumped && typeof dumped === 'object' ? dumped as { name?: unknown; message?: unknown } : null
      const errorMessage = typeof errorObject?.message === 'string'
        ? errorObject.message
        : typeof dumped === 'string' ? dumped : ''
      if (errorObject?.name === 'InternalError' || errorMessage.toLowerCase().includes('interrupted')) {
        throw new Error('Transformation exceeded the 1.5 second execution limit.')
      }
      throw new Error(errorMessage || 'Transformation failed while running.')
    }
    const output = context.getString(result.value)
    result.value.dispose()
    if (new TextEncoder().encode(output).byteLength > TRANSFORM_OUTPUT_LIMIT_BYTES) {
      throw new Error('Result exceeds the 512 KiB output limit.')
    }
    return output
  } finally {
    context.dispose()
    runtime.dispose()
  }
}
