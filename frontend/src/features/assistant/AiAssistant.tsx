import { useEffect, useRef, useState } from 'react'
import Button from '../../components/ui/Button'
import InlineMessage from '../../components/ui/InlineMessage'
import Panel from '../../components/ui/Panel'
import { parseJson } from '../../utils/json'
import { AiApiError, askAi } from './aiApi'

const QUESTION_LIMIT = 1000

type AssistantError = { message: string; requestId?: string | null; recoverable: boolean }

export default function AiAssistant({ source }: { source: string }) {
  const [question, setQuestion] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)
  const [answerRequestId, setAnswerRequestId] = useState<string | null>(null)
  const [error, setError] = useState<AssistantError | null>(null)
  const [loading, setLoading] = useState(false)
  const requestVersion = useRef(0)
  const inFlight = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    requestVersion.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    inFlight.current = false
    setLoading(false)
    setAnswer(null)
    setAnswerRequestId(null)
    setError(null)
  }, [source])

  useEffect(() => () => abortRef.current?.abort(), [])

  async function submit() {
    if (inFlight.current) return
    if (!acknowledged) {
      setError({ message: 'Acknowledge the data-sharing notice before asking the AI.', recoverable: false })
      return
    }
    if (!question.trim()) {
      setError({ message: 'Enter a question before submitting.', recoverable: false })
      return
    }
    if (question.length > QUESTION_LIMIT) {
      setError({ message: 'Keep your question to 1000 characters or fewer.', recoverable: false })
      return
    }

    let jsonData: unknown
    try {
      jsonData = parseJson(source)
    } catch (parseError) {
      setAnswer(null)
      setError({
        message: parseError instanceof Error ? `Fix the current JSON before asking: ${parseError.message}` : 'Fix the current JSON before asking.',
        recoverable: false,
      })
      return
    }

    const version = ++requestVersion.current
    const controller = new AbortController()
    abortRef.current = controller
    inFlight.current = true
    setLoading(true)
    setError(null)
    setAnswer(null)
    setAnswerRequestId(null)
    try {
      const result = await askAi({ question: question.trim(), jsonData }, controller.signal)
      if (requestVersion.current !== version) return
      setAnswer(result.answer)
      setAnswerRequestId(result.requestId)
    } catch (requestError) {
      if (controller.signal.aborted || requestVersion.current !== version) return
      const apiError = requestError instanceof AiApiError ? requestError : null
      setError({
        message: apiError?.message ?? 'Something went wrong while contacting the AI service. Please retry.',
        requestId: apiError?.requestId,
        recoverable: true,
      })
    } finally {
      if (requestVersion.current === version) {
        inFlight.current = false
        setLoading(false)
        abortRef.current = null
      }
    }
  }

  function clear() {
    requestVersion.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    inFlight.current = false
    setLoading(false)
    setQuestion('')
    setAnswer(null)
    setAnswerRequestId(null)
    setError(null)
  }

  return (
    <Panel className="assistant-panel">
      <div className="assistant-heading">
        <div><p className="eyebrow">Ask with context</p><h3>AI Assistant</h3></div>
        <span className="assistant-provider-label">Backend configured provider</span>
      </div>
      <div className="assistant-disclosure" role="note">
        <strong>Your JSON will be shared with the configured AI provider.</strong>
        <p>Nothing is sent automatically. Clicking <b>Ask AI</b> sends your question and the complete current JSON for processing; the provider may process it under its own data policies.</p>
        {!acknowledged && (
          <label className="assistant-acknowledgement">
            <input type="checkbox" checked={acknowledged} onChange={(event) => { setAcknowledged(event.target.checked); setError(null) }} />
            <span>I understand that my question and current JSON will be sent to the configured AI provider when I ask.</span>
          </label>
        )}
        {acknowledged && <p className="assistant-acknowledged" role="status">Data-sharing notice acknowledged for this session. Each request still requires an explicit click.</p>}
      </div>
      <form className="assistant-form" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <div className="assistant-question-label"><label htmlFor="assistant-question">Your question</label><span>{question.length}/{QUESTION_LIMIT}</span></div>
        <textarea
          id="assistant-question"
          value={question}
          maxLength={QUESTION_LIMIT}
          rows={3}
          placeholder="Ask a question about the JSON in your editor…"
          disabled={loading}
          onChange={(event) => { setQuestion(event.target.value); setError(null) }}
          aria-describedby="assistant-question-count"
        />
        <span id="assistant-question-count" className="visually-hidden">{question.length} of {QUESTION_LIMIT} characters</span>
        <div className="assistant-actions">
          <Button tone="primary" type="submit" disabled={loading}>
            {loading ? <><span className="loading-spinner" aria-hidden="true" /> Asking…</> : 'Ask AI'}
          </Button>
          <Button type="button" onClick={clear}>Clear assistant</Button>
        </div>
      </form>
      <div className="assistant-response" aria-live="polite" aria-busy={loading}>
        {loading ? <div className="assistant-empty"><span className="loading-spinner" aria-hidden="true" />Waiting for the AI provider…</div> : null}
        {!loading && answer && <section className="assistant-answer" aria-label="AI answer"><h4>Answer</h4><p>{answer}</p>{answerRequestId && <small>Request ID: <code>{answerRequestId}</code></small>}</section>}
        {!loading && !answer && !error && <div className="assistant-empty">Your answer will appear here after you ask a question.</div>}
        {!loading && error && (
          <div className="assistant-error-state">
            <InlineMessage>{error.message}</InlineMessage>
            {error.requestId && <p className="assistant-request-id">Request ID: <code>{error.requestId}</code></p>}
            {error.recoverable && <Button type="button" onClick={() => void submit()}>Retry</Button>}
          </div>
        )}
      </div>
    </Panel>
  )
}
