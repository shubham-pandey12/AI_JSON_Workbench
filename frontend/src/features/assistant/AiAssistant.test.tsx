import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AiAssistant from './AiAssistant'

afterEach(() => vi.unstubAllGlobals())

function response(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(payload) }
}

function acknowledge() {
  fireEvent.click(screen.getByRole('checkbox', { name: /I understand that my question and current JSON will be sent/i }))
}

function enterQuestion(value = 'What is in this JSON?') {
  fireEvent.change(screen.getByRole('textbox', { name: 'Your question' }), { target: { value } })
}

describe('AI Assistant', () => {
  it('renders the disclosure and does not request until acknowledgement and explicit submission', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ answer: 'It contains a user.', requestId: 'ask-123' }))
    vi.stubGlobal('fetch', fetchMock)
    render(<AiAssistant source={'{"user":"Ada"}'} />)

    expect(screen.getByText(/complete current JSON/i)).toBeInTheDocument()
    enterQuestion()
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
    expect(fetchMock).not.toHaveBeenCalled()

    acknowledge()
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
    expect(await screen.findByText('It contains a user.')).toBeInTheDocument()
    expect(screen.getByText('Request ID:')).toHaveTextContent('ask-123')
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/ai/ask', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What is in this JSON?', jsonData: { user: 'Ada' } }),
    }))
  })

  it('uses the latest editor JSON and clears stale answers when the document changes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ answer: 'Updated data.', requestId: null }))
    vi.stubGlobal('fetch', fetchMock)
    const { rerender } = render(<AiAssistant source={'{"version":1}'} />)
    acknowledge()
    enterQuestion('Summarize this')
    rerender(<AiAssistant source={'{"version":2}'} />)
    expect(screen.queryByText('Updated data.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
    await screen.findByText('Updated data.')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).jsonData).toEqual({ version: 2 })
  })

  it('shows a loading state and blocks duplicate requests', async () => {
    let resolveRequest!: (value: unknown) => void
    const fetchMock = vi.fn().mockReturnValue(new Promise((resolve) => { resolveRequest = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    render(<AiAssistant source="[]" />)
    acknowledge()
    enterQuestion()
    const askButton = screen.getByRole('button', { name: 'Ask AI' })
    fireEvent.click(askButton)
    expect(screen.getByText(/Waiting for the AI provider/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Asking/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Asking/ }))
    expect(fetchMock).toHaveBeenCalledOnce()
    resolveRequest(response({ answer: 'Done', requestId: null }))
    expect(await screen.findByText('Done')).toBeInTheDocument()
  })

  it('renders standardized provider errors with request IDs and retries', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ code: 'AI_PROVIDER_NOT_CONFIGURED', message: 'safe detail', requestId: 'req-45', details: [] }, 503))
      .mockResolvedValueOnce(response({ answer: 'It has two fields.', requestId: 'req-46' }))
    vi.stubGlobal('fetch', fetchMock)
    render(<AiAssistant source={'{"a":1,"b":2}'} />)
    acknowledge()
    enterQuestion()
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/not configured on the backend/i)
    expect(screen.getByText('Request ID:')).toHaveTextContent('req-45')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('It has two fields.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('handles network failures and malformed responses without exposing raw errors', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('internal socket details'))
      .mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn().mockRejectedValue(new Error('bad body')) })
    vi.stubGlobal('fetch', fetchMock)
    render(<AiAssistant source="true" />)
    acknowledge()
    enterQuestion()
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not reach the workbench API/i)
    expect(screen.queryByText(/internal socket details/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/unexpected response/i)
  })

  it('does not send empty or invalid JSON', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { rerender } = render(<AiAssistant source="" />)
    acknowledge()
    enterQuestion()
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/JSON input is empty/i)
    rerender(<AiAssistant source="{broken" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Fix the current JSON/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('invalidates an in-flight response when the editor content changes', async () => {
    let resolveRequest!: (value: unknown) => void
    const fetchMock = vi.fn().mockReturnValue(new Promise((resolve) => { resolveRequest = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    const { rerender } = render(<AiAssistant source={'{"version":1}'} />)
    acknowledge()
    enterQuestion()
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
    rerender(<AiAssistant source={'{"version":2}'} />)
    resolveRequest(response({ answer: 'Stale answer', requestId: null }))
    await waitFor(() => expect(screen.queryByText('Stale answer')).not.toBeInTheDocument())
    expect(screen.getByText(/answer will appear here/i)).toBeInTheDocument()
  })
})
