import { useEffect, useRef } from 'react'
import { basicSetup, EditorView } from 'codemirror'
import { json } from '@codemirror/lang-json'
import { indentUnit } from '@codemirror/language'

type JsonCodeEditorProps = { value: string; onChange: (value: string) => void }

const editorTheme = EditorView.theme({
  '&': { height: '100%', color: '#d8e1ee', backgroundColor: '#111b2b', fontSize: '13px' },
  '.cm-scroller': { overflow: 'auto', fontFamily: '"DM Mono", "SFMono-Regular", Consolas, monospace', lineHeight: '1.75' },
  '.cm-gutters': { backgroundColor: '#111b2b', color: '#65738a', border: 'none' },
  '.cm-activeLineGutter': { backgroundColor: '#18263a', color: '#a9b8cd' },
  '.cm-activeLine': { backgroundColor: '#ffffff08' },
  '.cm-cursor': { borderLeftColor: '#96b5fa' },
  '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: '#395681' },
  '.cm-content': { caretColor: '#96b5fa' },
})

export default function JsonCodeEditor({ value, onChange }: JsonCodeEditorProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const syncingRef = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!mountRef.current) return
    const view = new EditorView({
      doc: value,
      extensions: [
        basicSetup,
        json(),
        indentUnit.of('  '),
        editorTheme,
        EditorView.contentAttributes.of({ 'aria-label': 'JSON editor', 'aria-multiline': 'true' }),
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
    const view = viewRef.current
    if (view && view.state.doc.toString() !== value) {
      syncingRef.current = true
      try {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
      } finally {
        syncingRef.current = false
      }
    }
  }, [value])

  return <div className="code-editor" ref={mountRef} />
}
