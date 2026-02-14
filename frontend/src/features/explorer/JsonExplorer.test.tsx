import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import JsonExplorer from './JsonExplorer'
import { appendJsonPath } from './jsonTree'

describe('JSON tree explorer', () => {
  it('renders nested objects and arrays and lets users expand and select nodes', async () => {
    render(<JsonExplorer source={'{"users":[{"email":"ada@example.com"}]}'}/>)

    const tree = screen.getByRole('tree', { name: 'JSON structure' })
    expect(within(tree).getByText('Object · 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expand users' }))
    fireEvent.click(screen.getByRole('button', { name: 'Expand 0' }))
    const emailRow = within(tree).getByRole('button', { name: /email.*ada@example.com/i })
    fireEvent.click(emailRow)

    expect(screen.getByText('$.users[0].email')).toBeInTheDocument()
    expect(within(tree).getByText('Array · 1')).toBeInTheDocument()
  })

  it('shows empty object and array values without expand controls', () => {
    render(<JsonExplorer source={'{"emptyObject":{},"emptyArray":[]}'}/>)
    expect(screen.getByText('Object · 0')).toBeInTheDocument()
    expect(screen.getByText('Array · 0')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand emptyObject' })).toBeDisabled()
  })

  it('handles top-level primitive JSON values and keyboard tree navigation', () => {
    const { rerender } = render(<JsonExplorer source="null" />)
    expect(screen.getByText('null', { selector: '.tree-preview-null' })).toBeInTheDocument()
    rerender(<JsonExplorer source={'{"first":1,"second":false}'}/>)
    const rows = screen.getByRole('tree').querySelectorAll<HTMLButtonElement>('.tree-row-button')
    rows[0].focus()
    fireEvent.keyDown(rows[0], { key: 'ArrowDown' })
    expect(rows[1]).toHaveFocus()
  })

  it('uses safe bracket paths for special object keys', () => {
    render(<JsonExplorer source={'{"a.b":{"has space":{"say\\\"hi\\\"":null}}}'}/>)
    fireEvent.click(screen.getByRole('button', { name: 'Expand a.b' }))
    fireEvent.click(screen.getByRole('button', { name: 'Expand has space' }))
    const nullRow = screen.getByRole('button', { name: /say.*hi.*null/i })
    fireEvent.click(nullRow)

    const expectedPath = appendJsonPath(appendJsonPath(appendJsonPath('$', 'a.b'), 'has space'), 'say"hi"')
    expect(screen.getByText(expectedPath)).toBeInTheDocument()
  })

  it('searches keys and values, reports matches, and moves between results', async () => {
    render(<JsonExplorer source={'{"users":[{"name":"Ada"},{"name":"Ada"}]}'}/>)
    const search = screen.getByRole('searchbox', { name: 'Search JSON keys and values' })
    fireEvent.change(search, { target: { value: 'ada' } })

    await waitFor(() => expect(screen.getByText('1 of 2')).toBeInTheDocument())
    expect(screen.getByText('$.users[0].name')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next search match' }))
    expect(screen.getByText('$.users[1].name')).toBeInTheDocument()
    expect(screen.getByText('2 of 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Previous search match' }))
    expect(screen.getByText('$.users[0].name')).toBeInTheDocument()
  })

  it('shows empty and invalid JSON states', () => {
    const { rerender } = render(<JsonExplorer source="" />)
    expect(screen.getByText('No JSON to explore')).toBeInTheDocument()
    rerender(<JsonExplorer source="{broken" />)
    expect(screen.getByText('Invalid JSON')).toBeInTheDocument()
  })

  it('copies a selected path and reports clipboard errors', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<JsonExplorer source={'{"name":"Ada"}'}/>)
    fireEvent.click(screen.getByRole('button', { name: /name.*Ada/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy selected JSON path' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Clipboard access failed/i)
    expect(writeText).toHaveBeenCalledWith('$.name')
  })
})
