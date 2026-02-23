import { executeInQuickJs } from './executeInQuickJs'
import type { TransformWorkerRequest, TransformWorkerResponse } from './transformTypes'

self.addEventListener('message', (event: MessageEvent<TransformWorkerRequest>) => {
  void executeInQuickJs(event.data.code, event.data.jsonData)
    .then((output) => {
      const message: TransformWorkerResponse = { ok: true, output }
      self.postMessage(message)
    })
    .catch((error: unknown) => {
      const message: TransformWorkerResponse = {
        ok: false,
        message: error instanceof Error ? error.message : 'Transformation failed while running.',
      }
      self.postMessage(message)
    })
})
