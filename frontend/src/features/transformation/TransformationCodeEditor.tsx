import { useEffect, useRef } from 'react'
import { basicSetup, EditorView } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { Compartment, EditorState, type Extension } from '@codemirror/state'

const reviewEditorTheme = EditorView.theme({
  '&': { minHeight: '220px', color: '#d8e1ee', backgroundColor: '#111b2b', fontSize: '12px' },
  '.cm-scroller': { overflow: 'auto', fontFamily: '"DM Mono", "SFMono-Regular", Consolas, monospace', lineHeight: '1.65' },
  '.cm-gutters': { backgroundColor: '#111b2b', color: '#65738a', border: 'none' },
  '.cm-activeLineGutter': { backgroundColor: '#18263a', color: '#a9b8cd' },
  '.cm-activeLine': { backgroundColor: '#ffffff08' },
  '.cm-cursor': { borderLeftColor: '#96b5fa' },
  '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: '#395681' },
  '.cm-content': { caretColor: '#96b5fa' },
})

export default function TransformationCodeEditor({ value, onChange, readOnly = false }: { value: string; onChange: (value: string) => void; readOnly?: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const syncingRef = useRef(false)
  const onChangeRef = useRef(onChange)
  const readOnlyCompartment = useRef(new Compartment())
  onChangeRef.current = onChange

  useEffect(() => {
    if (!mountRef.current) return
    const view = new EditorView({
      doc: value,
      extensions: [
        basicSetup,
        javascript() as Extension,
        reviewEditorTheme,
        readOnlyCompartment.current.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
        EditorView.contentAttributes.of({ 'aria-label': 'Reviewed transformation code', 'aria-multiline': 'true' }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !syncingRef.current) onChangeRef.current(update.state.doc.toString())
        }),
      ],
      parent: mountRef.current,
    })
    viewRef.current = view
    return () => { view.destroy(); viewRef.current = null }
  }, [])

  useEffect(() => {
    viewRef.current?.dispatch({ effects: readOnlyCompartment.current.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]) })
  }, [readOnly])

  useEffect(() => {
    const view = viewRef.current
    if (view && view.state.doc.toString() !== value) {
      syncingRef.current = true
      try { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } }) }
      finally { syncingRef.current = false }
    }
  }, [value])

  return <div className="code-editor transformation-code-editor" ref={mountRef} />
}
