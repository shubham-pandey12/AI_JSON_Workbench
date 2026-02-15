export type AiAskRequest = { question: string; jsonData: unknown }
export type AiAskResponse = { answer: string; requestId: string | null }
export type ApiErrorDetail = { field?: string; code?: string; message?: string }
export type ApiErrorResponse = {
  code?: string
  message?: string
  requestId?: string | null
  details?: ApiErrorDetail[]
}

export class AiApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly requestId?: string | null,
    readonly details?: ApiErrorDetail[],
  ) {
    super(message)
    this.name = 'AiApiError'
  }
}

export async function askAi(request: AiAskRequest, signal?: AbortSignal): Promise<AiAskResponse> {
  let response: Response
  try {
    response = await fetch('/api/v1/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new AiApiError('Could not reach the workbench API. Check that the backend is running, then retry.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new AiApiError('The server returned an unexpected response. Please retry.')
  }

  if (!payload || typeof payload !== 'object') {
    throw new AiApiError('The server returned an unexpected response. Please retry.')
  }

  const data = payload as AiAskResponse & ApiErrorResponse
  if (!response.ok) {
    const messages: Record<string, string> = {
      VALIDATION_FAILED: 'Check the request fields and try again.',
      MALFORMED_REQUEST: 'The request could not be read. Check the JSON and try again.',
      REQUEST_TOO_LARGE: 'The current JSON is larger than the backend request limit. Reduce its size and retry.',
      AI_PROVIDER_NOT_CONFIGURED: 'The AI provider is not configured on the backend. Configure it, then retry.',
      AI_PROVIDER_TIMEOUT: 'The AI provider took too long to respond. Try again.',
      AI_PROVIDER_RATE_LIMITED: 'The AI provider is receiving too many requests. Wait a moment and retry.',
      AI_PROVIDER_CONFIGURATION_ERROR: 'The backend AI provider configuration needs attention.',
      AI_PROVIDER_UNAVAILABLE: 'The AI provider is temporarily unavailable. Try again shortly.',
      AI_PROVIDER_INVALID_RESPONSE: 'The AI provider returned an unusable response. Try again.',
      AI_PROVIDER_ERROR: 'The AI provider could not process this request. Try again.',
    }
    const detailMessage = data.details?.map((detail) => {
      const field = detail.field ? `${detail.field}: ` : ''
      return detail.message ? `${field}${detail.message}` : ''
    }).filter(Boolean).join(' ')
    const friendlyMessage = messages[data.code ?? ''] ?? 'The request failed. Please retry.'
    throw new AiApiError(
      data.code === 'VALIDATION_FAILED' && detailMessage ? `${friendlyMessage} ${detailMessage}` : friendlyMessage,
      data.code,
      data.requestId,
      data.details,
    )
  }

  if (typeof data.answer !== 'string' || !data.answer.trim()) {
    throw new AiApiError('The server response did not contain a usable answer.', undefined, data.requestId)
  }
  return { answer: data.answer, requestId: typeof data.requestId === 'string' ? data.requestId : null }
}
