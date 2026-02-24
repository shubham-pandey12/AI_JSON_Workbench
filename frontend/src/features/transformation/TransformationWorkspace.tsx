import { useEffect, useRef, useState } from 'react'
import Button from '../../components/ui/Button'
import InlineMessage from '../../components/ui/InlineMessage'
import Panel from '../../components/ui/Panel'
import StatusIndicator from '../../components/ui/StatusIndicator'
import { parseJson } from '../../utils/json'
import { generateTransformation, TransformApiError } from './transformApi'
import TransformationCodeEditor from './TransformationCodeEditor'
import { TRANSFORM_OUTPUT_LIMIT_BYTES } from './transformTypes'
import { runInWorker } from './workerRunner'

type Phase = 'idle' | 'generating' | 'review' | 'running' | 'success' | 'failure'
type Feedback = { message: string; requestId?: string | null }
const PROMPT_LIMIT = 1_000
const INPUT_LIMIT_BYTES = 256 * 1024

export default function TransformationWorkspace({ source }: { source: string }) {
  const [prompt, setPrompt] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [code, setCode] = useState('')
  const [generatedForSource, setGeneratedForSource] = useState<string | null>(null)
  const [output, setOutput] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const generationId = useRef(0)
  const runId = useRef(0)
  const sourceRef = useRef(source)
  const codeRef = useRef(code)
  const generatingRef = useRef(false)
  const runningRef = useRef(false)
  const generationAbort = useRef<AbortController | null>(null)
  const workerAbort = useRef<AbortController | null>(null)
  sourceRef.current = source
  codeRef.current = code

  useEffect(() => {
    generationId.current += 1
    generationAbort.current?.abort()
    generationAbort.current = null
    generatingRef.current = false
    setPhase(codeRef.current ? 'review' : 'idle')
    runId.current += 1
    workerAbort.current?.abort()
    workerAbort.current = null
    runningRef.current = false
    setOutput(null)
    setFeedback(null)
  }, [source])

  useEffect(() => () => {
    generationAbort.current?.abort()
    workerAbort.current?.abort()
  }, [])

  function readCurrentJson() {
    const inputBytes = new TextEncoder().encode(source).byteLength
    if (inputBytes > INPUT_LIMIT_BYTES) throw new Error('The current JSON exceeds the 256 KiB input limit. Reduce its size and retry.')
    return parseJson(source)
  }

  async function generateCode() {
    if (generatingRef.current || runningRef.current) return
    if (!acknowledged) {
      setFeedback({ message: 'Acknowledge the data-sharing notice before sending a prompt and JSON to the AI provider.' })
      return
    }
    if (!prompt.trim()) {
      setFeedback({ message: 'Describe the transformation you want before requesting code.' })
      return
    }
    let jsonData: unknown
    try { jsonData = readCurrentJson() }
    catch (error) {
      setFeedback({ message: error instanceof Error ? `Cannot generate code: ${error.message}` : 'Cannot generate code from the current JSON.' })
      return
    }
    const requestId = ++generationId.current
    const snapshot = source
    const controller = new AbortController()
    generationAbort.current = controller
    generatingRef.current = true
    setPhase('generating')
    setFeedback(null)
    setOutput(null)
    try {
      const proposal = await generateTransformation({ prompt: prompt.trim(), jsonData }, controller.signal)
      if (generationId.current !== requestId || sourceRef.current !== snapshot) return
      setCode(proposal.code)
      codeRef.current = proposal.code
      setGeneratedForSource(snapshot)
      setPhase('review')
      setFeedback(proposal.requestId ? { message: 'Review and edit the proposed function before running it.', requestId: proposal.requestId } : null)
    } catch (error) {
      if (controller.signal.aborted || generationId.current !== requestId) return
      const apiError = error instanceof TransformApiError ? error : null
      setPhase('failure')
      setFeedback({ message: apiError?.message ?? 'Could not generate a transformation proposal. Please retry.', requestId: apiError?.requestId })
    } finally {
      if (generationId.current === requestId) {
        generatingRef.current = false
        generationAbort.current = null
        if (phase === 'generating') setPhase(codeRef.current ? 'review' : 'idle')
      }
    }
  }

  async function runTransformation() {
    if (runningRef.current || generatingRef.current) return
    if (!code.trim()) {
      setPhase('failure')
      setFeedback({ message: 'Generate or enter a transform(input) function and review it before running.' })
      return
    }
    let jsonData: unknown
    try { jsonData = readCurrentJson() }
    catch (error) {
      setPhase('failure')
      setFeedback({ message: error instanceof Error ? `Cannot run transformation: ${error.message}` : 'Cannot run against the current JSON.' })
      return
    }
    const snapshot = source
    const requestId = ++runId.current
    const controller = new AbortController()
    workerAbort.current = controller
    runningRef.current = true
    setPhase('running')
    setFeedback(null)
    setOutput(null)
    try {
      const result = await runInWorker({ code, jsonData }, undefined, undefined, controller.signal)
      if (runId.current !== requestId || sourceRef.current !== snapshot) return
      const prettyOutput = JSON.stringify(JSON.parse(result) as unknown, null, 2)
      if (new TextEncoder().encode(prettyOutput).byteLength > TRANSFORM_OUTPUT_LIMIT_BYTES) {
        throw new Error('Result exceeds the 512 KiB output limit.')
      }
      setOutput(prettyOutput)
      setPhase('success')
    } catch (error) {
      if (controller.signal.aborted || runId.current !== requestId) return
      setPhase('failure')
      setFeedback({ message: error instanceof Error ? error.message : 'Transformation failed while running.' })
    } finally {
      if (runId.current === requestId) {
        runningRef.current = false
        workerAbort.current = null
      }
    }
  }

  function updateCode(nextCode: string) {
    setCode(nextCode)
    codeRef.current = nextCode
    setOutput(null)
    if (runningRef.current) {
      runId.current += 1
      workerAbort.current?.abort()
      workerAbort.current = null
      runningRef.current = false
    }
    setPhase(nextCode.trim() ? 'review' : 'idle')
    setFeedback(null)
  }

  function resetWorkspace() {
    if (code && !window.confirm('Reset this workspace and discard the reviewed transformation code?')) return
    generationId.current += 1
    generationAbort.current?.abort()
    generationAbort.current = null
    generatingRef.current = false
    runId.current += 1
    workerAbort.current?.abort()
    workerAbort.current = null
    runningRef.current = false
    setPrompt('')
    setCode('')
    codeRef.current = ''
    setGeneratedForSource(null)
    setOutput(null)
    setFeedback(null)
    setPhase('idle')
  }

  async function copyOutput() {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      setFeedback({ message: 'Transformation output copied.' })
    } catch {
      setFeedback({ message: 'Clipboard access failed. Select and copy the output manually.' })
    }
  }

  function downloadOutput() {
    if (!output) return
    try {
      const url = URL.createObjectURL(new Blob([output], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'transformed.json'
      link.click()
      URL.revokeObjectURL(url)
      setFeedback({ message: 'Transformation output download started.' })
    } catch {
      setFeedback({ message: 'Could not create the download. Try copying the output instead.' })
    }
  }

  const phaseLabel: Record<Phase, string> = {
    idle: 'Not started', generating: 'Generating code', review: 'Ready for review', running: 'Running locally', success: 'Transformation complete', failure: 'Needs attention',
  }
  const sourceChangedSinceGeneration = generatedForSource !== null && generatedForSource !== source

  return (
    <Panel className="transformation-panel">
      <div className="transformation-heading">
        <div><p className="eyebrow">Reviewed execution</p><h3>Transformation workspace</h3></div>
        <StatusIndicator state={phase === 'success' ? 'valid' : phase === 'failure' ? 'invalid' : 'idle'}>{phaseLabel[phase]}</StatusIndicator>
      </div>
      <p className="transformation-intro">Describe a JSON transformation, review the generated function, then choose when to run it. The editor contents are never replaced.</p>
      <div className="assistant-disclosure transformation-disclosure" role="note">
        <strong>Code generation sends data to the configured AI provider.</strong>
        <p>When you click <b>Generate code</b>, this prompt and the complete current JSON are sent to the provider. Nothing is sent or executed automatically. Review the proposal carefully; do not run code you do not trust.</p>
        {!acknowledged && <label className="assistant-acknowledgement"><input type="checkbox" checked={acknowledged} onChange={(event) => { setAcknowledged(event.target.checked); setFeedback(null) }} /><span>I understand that my prompt and current JSON will be sent to the configured AI provider when I request code.</span></label>}
        {acknowledged && <p className="assistant-acknowledged" role="status">Data-sharing notice acknowledged. Every code request still requires a click.</p>}
      </div>
      <label className="transformation-label" htmlFor="transformation-prompt">Describe the transformation</label>
      <div className="transformation-prompt-row">
        <textarea id="transformation-prompt" rows={2} maxLength={PROMPT_LIMIT} value={prompt} disabled={phase === 'generating' || phase === 'running'} placeholder="For example: Keep only users whose active field is true." onChange={(event) => { setPrompt(event.target.value); setFeedback(null) }} />
        <div className="transformation-prompt-actions">
          <span>{prompt.length}/{PROMPT_LIMIT}</span>
          <Button tone="primary" onClick={() => void generateCode()} disabled={phase === 'generating' || phase === 'running'}>{phase === 'generating' ? 'Generating…' : 'Generate code'}</Button>
        </div>
      </div>
      <p className="transformation-snapshot">Current editor snapshot: {source.trim() ? `${new TextEncoder().encode(source).byteLength.toLocaleString()} bytes` : 'empty'} · Run always uses the latest editor JSON.</p>
      {sourceChangedSinceGeneration && <InlineMessage tone="info">The editor changed after this code was generated. Running uses the latest JSON; review the code against that data before proceeding.</InlineMessage>}
      <div className="transformation-warning" role="note"><strong>Worker execution is not a complete security boundary.</strong> Reviewed code runs in an isolated QuickJS WebAssembly interpreter inside a disposable Web Worker, without host APIs. Do not run code you do not trust.</div>
      <div className="transformation-code-heading"><label>Review and edit transformation code</label><span>Expected signature: function transform(input)</span></div>
      <TransformationCodeEditor value={code} onChange={updateCode} readOnly={phase === 'generating'} />
      {feedback && <div className="transformation-feedback"><InlineMessage tone={phase === 'success' ? 'success' : phase === 'review' ? 'info' : 'error'}>{feedback.message}</InlineMessage>{feedback.requestId && <p className="assistant-request-id">Request ID: <code>{feedback.requestId}</code></p>}</div>}
      <div className="transformation-controls">
        <Button tone="primary" onClick={() => void runTransformation()} disabled={phase === 'generating' || phase === 'running' || !code.trim()}>{phase === 'running' ? 'Running…' : 'Run transformation'}</Button>
        <Button onClick={resetWorkspace}>Reset workspace</Button>
        <span className="transformation-limit-note">1.5 s execution deadline · 8 MiB interpreter memory · 512 KiB output limit</span>
      </div>
      <section className="transformation-output" aria-label="Transformation output" aria-live="polite">
        <div className="transformation-code-heading"><h4>Output JSON</h4>{output && <div className="toolbar-group"><Button onClick={() => void copyOutput()}>Copy output</Button><Button onClick={downloadOutput}>Download output</Button></div>}</div>
        {phase === 'running' && <div className="assistant-empty" aria-busy="true"><span className="loading-spinner" aria-hidden="true" />Running the reviewed function in a disposable worker…</div>}
        {output ? <pre className="transformation-output-json">{output}</pre> : phase !== 'running' && <div className="assistant-empty">A successful transformation result will appear here. The source JSON remains unchanged.</div>}
      </section>
    </Panel>
  )
}
