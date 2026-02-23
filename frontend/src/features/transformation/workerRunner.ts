import { TRANSFORM_WORKER_TIMEOUT_MS } from './transformTypes'
import type { TransformWorkerRequest, TransformWorkerResponse } from './transformTypes'

export type WorkerLike = Pick<Worker, 'postMessage' | 'terminate'> & {
  onmessage: ((event: MessageEvent<TransformWorkerResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
}

export function runInWorker(
  request: TransformWorkerRequest,
  createWorker: () => WorkerLike = () => new Worker(new URL('./transformation.worker.ts', import.meta.url), { type: 'module' }),
  timeoutMs = TRANSFORM_WORKER_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let worker: WorkerLike
    try {
      worker = createWorker()
    } catch {
      reject(new Error('The transformation worker could not be started.'))
      return
    }
    let settled = false
    const finish = (error: Error | null, output?: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      worker.terminate()
      if (error) reject(error)
      else resolve(output ?? '')
    }
    const onAbort = () => finish(new Error('Transformation was cancelled because the source JSON changed.'))
    const timer = setTimeout(() => finish(new Error('Transformation worker timed out and was stopped.')), timeoutMs)
    if (signal?.aborted) { onAbort(); return }
    signal?.addEventListener('abort', onAbort, { once: true })
    worker.onmessage = (event) => {
      if (!event.data || typeof event.data.ok !== 'boolean') {
        finish(new Error('The transformation worker returned an invalid response.'))
      } else if (event.data.ok) {
        finish(null, event.data.output)
      } else {
        finish(new Error(event.data.message || 'Transformation failed while running.'))
      }
    }
    worker.onerror = () => finish(new Error('The transformation worker failed unexpectedly and was stopped.'))
    try {
      worker.postMessage(request)
    } catch {
      finish(new Error('The JSON snapshot or code could not be sent to the worker.'))
    }
  })
}
