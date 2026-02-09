import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

describe('JSON editor shell', () => {
  it('renders the editor and its core actions', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'AI JSON Workbench' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'JSON editor' })).toBeInTheDocument()
    for (const label of ['Format', 'Minify', 'Validate', 'Upload', 'Copy', 'Download', 'Clear']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('reports invalid uploaded JSON and clears the stale error when content is cleared', async () => {
    render(<App />)
    const upload = screen.getByLabelText('Upload JSON file')
    const malformed = new File(['{\n  "name": 1,\n}'], 'broken.json', { type: 'application/json' })
    Object.defineProperty(malformed, 'text', { value: async () => '{\n  "name": 1,\n}' })
    fireEvent.change(upload, { target: { files: [malformed] } })

    expect(await screen.findByRole('alert')).toHaveTextContent(/Invalid JSON.*line 3/i)
    expect(document.querySelector('.status-invalid')).toHaveTextContent('Invalid JSON')

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.getByText('Not validated')).toBeInTheDocument()
  })

  it('loads a valid JSON file and formats it in the editor', async () => {
    render(<App />)
    const upload = screen.getByLabelText('Upload JSON file')
    const file = new File(['{"user":{"active":true}}'], 'sample.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => '{"user":{"active":true}}' })
    fireEvent.change(upload, { target: { files: [file] } })
    await screen.findByText('Loaded sample.json.')

    fireEvent.click(screen.getByRole('button', { name: 'Format' }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'JSON editor' })).toHaveTextContent('active'))
    expect(await screen.findByText('JSON formatted with two-space indentation.')).toBeInTheDocument()
  })

  it('does not copy invalid JSON', async () => {
    render(<App />)
    const file = new File(['{nope'], 'broken.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => '{nope' })
    fireEvent.change(screen.getByLabelText('Upload JSON file'), { target: { files: [file] } })
    await screen.findByRole('alert')
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).not.toHaveBeenCalled()
  })

  it('shows a useful message when clipboard access is denied', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('permission denied'))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Clipboard access failed/i)
    expect(writeText).toHaveBeenCalledOnce()
  })

  it('downloads the current valid JSON as a file', () => {
    const createObjectURL = vi.fn(() => 'blob:workbench')
    const revokeObjectURL = vi.fn()
    const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
    const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    try {
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: 'Download' }))
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      expect(click).toHaveBeenCalledOnce()
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:workbench')
    } finally {
      click.mockRestore()
      if (createDescriptor) Object.defineProperty(URL, 'createObjectURL', createDescriptor)
      else Reflect.deleteProperty(URL, 'createObjectURL')
      if (revokeDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor)
      else Reflect.deleteProperty(URL, 'revokeObjectURL')
    }
  })

  it('rejects an empty upload without replacing the current document', async () => {
    render(<App />)
    const file = new File([], 'empty.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => '' })
    fireEvent.change(screen.getByLabelText('Upload JSON file'), { target: { files: [file] } })

    expect(await screen.findByRole('alert')).toHaveTextContent(/file is empty/i)
    expect(screen.getByRole('textbox', { name: 'JSON editor' })).toHaveTextContent('AI JSON Workbench')
  })

  it('keeps the explorer synchronized with a new editor document', async () => {
    render(<App />)
    const file = new File(['{"newRecord":{"enabled":true}}'], 'updated.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => '{"newRecord":{"enabled":true}}' })
    fireEvent.change(screen.getByLabelText('Upload JSON file'), { target: { files: [file] } })

    expect(await screen.findByText('Loaded updated.json.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /newRecord.*Object.*1/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expand newRecord' }))
    expect(screen.getByRole('button', { name: /enabled.*true/i })).toBeInTheDocument()
  })
})
