import { useRef, useState } from 'react'
import Button from '../../components/ui/Button'
import InlineMessage from '../../components/ui/InlineMessage'
import Panel from '../../components/ui/Panel'
import StatusIndicator from '../../components/ui/StatusIndicator'
import type { JsonValidation } from '../../types/json'
import { formatJson, minifyJson, validateJson } from '../../utils/json'
import JsonExplorer from '../explorer/JsonExplorer'
import AiAssistant from '../assistant/AiAssistant'
import TransformationWorkspace from '../transformation/TransformationWorkspace'
import JsonCodeEditor from './JsonCodeEditor'

const exampleJson = `{
  "project": "AI JSON Workbench",
  "version": 1,
  "localFirst": true,
  "features": ["format", "minify", "validate"],
  "owner": null
}`

export default function JsonWorkbench() {
  const [value, setValue] = useState(exampleJson)
  const [validation, setValidation] = useState<JsonValidation | null>(null)
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' | 'info' } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function updateValue(nextValue: string) {
    setValue(nextValue)
    setValidation(null)
    setMessage(null)
  }

  function validateCurrent(): boolean {
    const result = validateJson(value)
    setValidation(result)
    setMessage(result.valid ? { text: 'Your JSON is valid.', tone: 'success' } : { text: result.message, tone: 'error' })
    return result.valid
  }

  function transform(operation: (source: string) => string, successText: string) {
    try {
      const nextValue = operation(value)
      setValue(nextValue)
      setValidation({ valid: true })
      setMessage({ text: successText, tone: 'success' })
    } catch (error) {
      setValidation(validateJson(value))
      setMessage({ text: error instanceof Error ? error.message : 'Could not process this JSON.', tone: 'error' })
    }
  }

  async function uploadFile(file?: File) {
    if (!file) return
    try {
      const text = await file.text()
      if (!text.trim()) {
        setMessage({ text: 'The selected file is empty. Choose a JSON file with content.', tone: 'error' })
        return
      }
      setValue(text)
      const result = validateJson(text)
      setValidation(result)
      setMessage(result.valid
        ? { text: `Loaded ${file.name}.`, tone: 'success' }
        : { text: `${file.name} was loaded, but ${result.message}`, tone: 'error' })
    } catch {
      setMessage({ text: 'This file could not be read. Choose another .json file.', tone: 'error' })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function copyJson() {
    if (!validateCurrent()) return
    try {
      await navigator.clipboard.writeText(value)
      setMessage({ text: 'JSON copied to the clipboard.', tone: 'success' })
    } catch {
      setMessage({ text: 'Clipboard access failed. Check browser permissions and try again.', tone: 'error' })
    }
  }

  function downloadJson() {
    if (!validateCurrent()) return
    try {
      const blob = new Blob([value], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'workbench.json'
      link.click()
      URL.revokeObjectURL(url)
      setMessage({ text: 'JSON download started.', tone: 'success' })
    } catch {
      setMessage({ text: 'Could not create the download. Try copying the JSON instead.', tone: 'error' })
    }
  }

  function clearEditor() {
    updateValue('')
    setMessage({ text: 'Editor cleared.', tone: 'info' })
  }

  const statusState = validation === null ? 'idle' : validation.valid ? 'valid' : 'invalid'
  const statusText = validation === null ? 'Not validated' : validation.valid ? 'Valid JSON' : 'Invalid JSON'

  return (
    <main className="workbench-shell">
      <header className="app-header">
        <div className="brand"><span className="brand-mark" aria-hidden="true">{`{ }`}</span><div><p className="eyebrow">Developer tools</p><h1>AI JSON Workbench</h1></div></div>
        <span className="privacy-note"><span aria-hidden="true">●</span> Processed locally in your browser</span>
      </header>
      <div className="page-heading">
        <div><p className="eyebrow">JSON editor</p><h2>Shape your data.</h2><p className="page-subtitle">Format, inspect, and validate JSON without sending it anywhere.</p></div>
        <StatusIndicator state={statusState}>{statusText}</StatusIndicator>
      </div>
      <div className="workspace-grid">
        <Panel className="editor-panel">
          <div className="toolbar" aria-label="JSON actions">
            <div className="toolbar-group">
              <Button tone="primary" onClick={() => transform(formatJson, 'JSON formatted with two-space indentation.')}>Format</Button>
              <Button onClick={() => transform(minifyJson, 'JSON minified.')}>Minify</Button>
              <Button onClick={validateCurrent}>Validate</Button>
            </div>
            <div className="toolbar-group toolbar-file-actions">
              <input ref={fileInputRef} className="visually-hidden" type="file" accept=".json,application/json" aria-label="Upload JSON file" tabIndex={-1} onChange={(event) => void uploadFile(event.target.files?.[0])} />
              <Button onClick={() => fileInputRef.current?.click()}>Upload</Button>
              <Button onClick={() => void copyJson()}>Copy</Button>
              <Button onClick={downloadJson}>Download</Button>
              <Button tone="quiet" onClick={clearEditor}>Clear</Button>
            </div>
          </div>
          <div className="editor-meta"><span>JSON</span><span>UTF-8 <i aria-hidden="true">·</i> 2 spaces</span></div>
          <JsonCodeEditor value={value} onChange={updateValue} />
          <div className="editor-footer"><span>{value.length.toLocaleString()} characters</span><span>Changes stay in this browser</span></div>
        </Panel>
        <JsonExplorer source={value} />
      </div>
      <AiAssistant source={value} />
      <TransformationWorkspace source={value} />
      {message && <InlineMessage tone={message.tone}>{message.text}</InlineMessage>}
      <footer className="app-footer"><span>Local-first by design</span><i aria-hidden="true">•</i><span>AI actions will always be explicit</span></footer>
    </main>
  )
}
