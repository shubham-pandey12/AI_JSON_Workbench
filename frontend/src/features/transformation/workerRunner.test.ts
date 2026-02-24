import { describe, expect, it, vi } from 'vitest'
import { runInWorker, type WorkerLike } from './workerRunner'
import type { TransformWorkerResponse } from './transformTypes'

function fakeWorker() {
  const worker: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
  }
  return worker
}

describe('transformation worker lifecycle', () => {
  it('returns a successful result and terminates the worker', async () => {
    const worker = fakeWorker()
    const result = runInWorker({ code: 'function transform(input) { return input; }', jsonData: { id: 1 } }, () => worker)
    worker.onmessage?.({ data: { ok: true, output: '{"id":1}' } as TransformWorkerResponse } as MessageEvent<TransformWorkerResponse>)
    await expect(result).resolves.toBe('{"id":1}')
    expect(worker.postMessage).toHaveBeenCalledWith({ code: 'function transform(input) { return input; }', jsonData: { id: 1 } })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('handles worker error, malformed response, and timeout with cleanup', async () => {
    const broken = fakeWorker()
    const failed = runInWorker({ code: '', jsonData: null }, () => broken)
    broken.onerror?.({} as ErrorEvent)
    await expect(failed).rejects.toThrow(/worker failed/i)
    expect(broken.terminate).toHaveBeenCalledOnce()

    const malformed = fakeWorker()
    const malformedResult = runInWorker({ code: '', jsonData: null }, () => malformed)
    malformed.onmessage?.({ data: { nope: true } as unknown as TransformWorkerResponse } as MessageEvent<TransformWorkerResponse>)
    await expect(malformedResult).rejects.toThrow(/invalid response/i)
    expect(malformed.terminate).toHaveBeenCalledOnce()

    const timed = fakeWorker()
    const timedResult = runInWorker({ code: '', jsonData: null }, () => timed, 1)
    await expect(timedResult).rejects.toThrow(/timed out/i)
    expect(timed.terminate).toHaveBeenCalledOnce()
  })

  it('terminates on abort so source changes cannot produce stale output', async () => {
    const worker = fakeWorker()
    const controller = new AbortController()
    const result = runInWorker({ code: '', jsonData: {} }, () => worker, 100, controller.signal)
    controller.abort()
    await expect(result).rejects.toThrow(/cancelled/i)
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
})
