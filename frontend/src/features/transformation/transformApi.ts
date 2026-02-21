import type { TransformRequest, TransformResponse } from './transformTypes'

export class TransformApiError extends Error {
  constructor(message: string, readonly requestId?: string | null) {
    super(message)
    this.name = 'TransformApiError'
  }
}

export async function generateTransformation(request: TransformRequest, signal?: AbortSignal): Promise<TransformResponse> {
  let response: Response
  try {
    response = await fetch('/api/v1/ai/transform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new TransformApiError('Could not reach the workbench API. Check that the backend is running, then retry.')
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new TransformApiError('The server returned an unexpected response. Please retry.')
  }
  if (!payload || typeof payload !== 'object') {
    throw new TransformApiError('The server returned an unexpected response. Please retry.')
  }
  const data = payload as { code?: string; requestId?: string | null; answer?: string; message?: string }
  if (!response.ok) {
    const knownMessages: Record<string, string> = {
      VALIDATION_FAILED: 'Check the prompt and JSON, then try again.',
      MALFORMED_REQUEST: 'The request could not be read. Check the JSON and try again.',
      REQUEST_TOO_LARGE: 'The current JSON exceeds the backend request limit. Reduce its size and retry.',
      AI_PROVIDER_NOT_CONFIGURED: 'The AI provider is not configured on the backend. Configure it, then retry.',
      AI_PROVIDER_TIMEOUT: 'The AI provider took too long to respond. Try again.',
      AI_PROVIDER_RATE_LIMITED: 'The AI provider is receiving too many requests. Wait a moment and retry.',
      AI_PROVIDER_CONFIGURATION_ERROR: 'The backend AI provider configuration needs attention.',
      AI_PROVIDER_UNAVAILABLE: 'The AI provider is temporarily unavailable. Try again shortly.',
      AI_PROVIDER_INVALID_RESPONSE: 'The AI provider returned an invalid transformation proposal.',
      AI_PROVIDER_ERROR: 'The AI provider could not process the request. Try again.',
    }
    throw new TransformApiError(knownMessages[data.code ?? ''] ?? 'The transformation request failed. Please retry.', data.requestId)
  }
  if (typeof data.code !== 'string' || !/^function\s+transform\s*\(\s*input\s*\)\s*\{[\s\S]*}\s*$/.test(data.code) || data.code.length > 20_000) {
    throw new TransformApiError('The provider response did not contain a valid transformation function.', data.requestId)
  }
  return { code: data.code, requestId: typeof data.requestId === 'string' ? data.requestId : null }
}
