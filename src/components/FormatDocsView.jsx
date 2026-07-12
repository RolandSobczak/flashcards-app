import { useState } from 'react'
import MiniMarkdown from './MiniMarkdown'
import SET_FORMAT_MARKDOWN from '../docs/set-format.md?raw'

const SET_FORMAT_FILENAME = 'format-zestawu-fiszek.md'

export default function FormatDocsView({ onBack }) {
  const [copied, setCopied] = useState(false)

  function handleDownload() {
    const blob = new Blob([SET_FORMAT_MARKDOWN], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = SET_FORMAT_FILENAME
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(SET_FORMAT_MARKDOWN)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('Nie udało się skopiować do schowka.')
    }
  }

  return (
    <div className="tasks-view">
      <div className="tasks-header">
        <button className="btn-back" onClick={onBack}>← Menu</button>
        <h2 className="tasks-title">Format zestawu (dla LLM)</h2>
      </div>

      <div className="docs-toolbar">
        <button className="btn-primary" onClick={handleDownload}>Pobierz plik .md</button>
        <button className="btn-secondary" onClick={handleCopy}>
          {copied ? 'Skopiowano ✓' : 'Kopiuj do schowka'}
        </button>
      </div>

      <MiniMarkdown text={SET_FORMAT_MARKDOWN} />
    </div>
  )
}
