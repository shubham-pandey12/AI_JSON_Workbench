export type TransformRequest = { prompt: string; jsonData: unknown }
export type TransformResponse = { code: string; requestId: string | null }
export type TransformWorkerRequest = { code: string; jsonData: unknown }
export type TransformWorkerResponse = { ok: true; output: string } | { ok: false; message: string }

export const TRANSFORM_CODE_LIMIT = 20_000
export const TRANSFORM_OUTPUT_LIMIT_BYTES = 512 * 1024
export const TRANSFORM_DEADLINE_MS = 1_500
export const TRANSFORM_WORKER_TIMEOUT_MS = 5_000
