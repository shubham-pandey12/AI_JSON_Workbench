import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TransformationWorkspace from './TransformationWorkspace'

const { runInWorker } = vi.hoisted(() => ({ runInWorker: vi.fn() }))
vi.mock('./workerRunner', () => ({ runInWorker }))

afterEach(() => vi.unstubAllGlobals())
beforeEach(() => { runInWorker.mockReset() })

function response(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(payload) }
}

async function prepareAndGenerate(source = '{"items":[1,2]}') {
  const fetchMock = vi.fn().mockResolvedValue(response({
    code: 'function transform(input) { return input.items.filter((item) => item > 1); }',
    requestId: 'generate-6',
  }))
  vi.stubGlobal('fetch', fetchMock)
  const view = render(<TransformationWorkspace source={source} />)
  fireEvent.click(screen.getByRole('checkbox', { name: /my prompt and current JSON will be sent/i }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Describe the transformation' }), { target: { value: 'Keep items above one' } })
  fireEvent.click(screen.getByRole('button', { name: 'Generate code' }))
  await screen.findByText(/Review and edit the proposed function/)
  return { ...view, fetchMock }
}

describe('Transformation workspace', () => {
  it('sends an explicit code-generation request but does not run the proposal', async () => {
    const { fetchMock } = await prepareAndGenerate()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/ai/transform', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ prompt: 'Keep items above one', jsonData: { items: [1, 2] } }),
    }))
    expect(screen.getByText(/function transform/)).toBeInTheDocument()
    expect(runInWorker).not.toHaveBeenCalled()
    expect(screen.getByText(/editor contents are never replaced/i)).toBeInTheDocument()
  })

  it('runs only after an explicit click using the latest JSON snapshot and keeps output separate', async () => {
    runInWorker.mockResolvedValue('[2,3]')
    const { rerender } = await prepareAndGenerate('{"items":[1,2]}')
    rerender(<TransformationWorkspace source={'{"items":[2,3]}'} />)
    expect(screen.getByText(/editor changed after this code was generated/i)).toBeInTheDocument()
    expect(runInWorker).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Run transformation' }))
    expect(await screen.findByText('[ 2, 3 ]', { selector: 'pre' })).toBeInTheDocument()
    expect(runInWorker).toHaveBeenCalledWith(expect.objectContaining({
      code: 'function transform(input) { return input.items.filter((item) => item > 1); }',
      jsonData: { items: [2, 3] },
    }), undefined, undefined, expect.any(AbortSignal))
    expect(screen.getByText(/editor contents are never replaced/i)).toBeInTheDocument()
  })

  it('prevents duplicate worker runs while the first run is pending', async () => {
    let finishRun!: (output: string) => void
    runInWorker.mockReturnValue(new Promise<string>((resolve) => { finishRun = resolve }))
    await prepareAndGenerate()
    const runButton = screen.getByRole('button', { name: 'Run transformation' })
    fireEvent.click(runButton)
    expect(screen.getByRole('button', { name: 'Running…' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Running…' }))
    expect(runInWorker).toHaveBeenCalledOnce()
    finishRun('{"ok":true}')
    expect(await screen.findByText(/"ok": true/)).toBeInTheDocument()
  })

  it('shows malformed generation responses without running code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ code: 'Here is JavaScript', requestId: 'bad-code' })))
    render(<TransformationWorkspace source="{}" />)
    fireEvent.click(screen.getByRole('checkbox', { name: /my prompt and current JSON will be sent/i }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe the transformation' }), { target: { value: 'Return an empty object' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate code' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid transformation function/i)
    expect(runInWorker).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON before requesting or running code', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<TransformationWorkspace source="" />)
    fireEvent.click(screen.getByRole('checkbox', { name: /my prompt and current JSON will be sent/i }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe the transformation' }), { target: { value: 'Do something' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate code' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/JSON input is empty/i)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(runInWorker).not.toHaveBeenCalled()
  })

  it('requires explicit confirmation before reset discards reviewed code', async () => {
    const confirm = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirm)
    await prepareAndGenerate()
    fireEvent.click(screen.getByRole('button', { name: 'Reset workspace' }))
    expect(confirm).toHaveBeenCalledOnce()
    expect(screen.getByText(/function transform/)).toBeInTheDocument()
  })
})
