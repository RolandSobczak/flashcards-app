import { useEffect, useRef, useState } from 'react'
import { createSet, deleteSet, exportSetUrl, getSet, listSets } from '../api'

function groupByCategory(sets) {
  const groups = new Map()
  for (const s of sets) {
    const key = s.category || 'Bez kategorii'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(s)
  }
  return groups
}

export default function Menu({ onData, onTasks, onDocs }) {
  const [sets, setSets] = useState(null) // null = loading
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    let cancelled = false
    listSets()
      .then(data => { if (!cancelled) setSets(data) })
      .catch(() => { if (!cancelled) setError('Nie można połączyć się z backendem. Uruchom: uvicorn backend.main:app --reload') })
    return () => { cancelled = true }
  }, [])

  async function loadSet(set) {
    try {
      const detail = await getSet(set.id)
      onData(detail.cards, detail.label)
    } catch {
      alert('Nie udało się wczytać zestawu.')
    }
  }

  async function handleDelete(e, set) {
    e.stopPropagation()
    if (!window.confirm(`Usunąć zestaw „${set.label}”?`)) return
    try {
      await deleteSet(set.id)
      setSets(prev => prev.filter(s => s.id !== set.id))
    } catch {
      alert('Nie udało się usunąć zestawu.')
    }
  }

  function handleExport(e, set) {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = exportSetUrl(set.id)
    a.download = `${set.slug}.zip`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function uploadFile(file) {
    if (!file || uploading) return
    setUploading(true)
    try {
      const label = file.name.replace(/\.(json|zip)$/i, '')
      const created = await createSet(file, label)
      setSets(prev => [
        { id: created.id, slug: created.slug, label: created.label, category: created.category, cardCount: created.cards.length, createdAt: created.createdAt },
        ...(prev ?? []),
      ])
      onData(created.cards, created.label)
    } catch {
      alert('Nieprawidłowy plik JSON/ZIP albo błąd zapisu na serwerze.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="menu">
      {error && (
        <div className="tasks-error">
          <div className="tasks-error-icon">⚠</div>
          <div>{error}</div>
        </div>
      )}

      {sets === null && !error && (
        <div className="tasks-status">Ładuję zestawy…</div>
      )}

      {sets !== null && sets.length === 0 && (
        <div className="tasks-status">Brak zapisanych zestawów. Wczytaj plik JSON poniżej, aby dodać pierwszy.</div>
      )}

      {sets !== null && sets.length > 0 && Array.from(groupByCategory(sets).entries()).map(([category, group], i) => (
        <div key={category} className="menu-section">
          {i === 0 ? (
            <div className="menu-section-label">{category}</div>
          ) : (
            <div className="menu-divider"><span>{category}</span></div>
          )}
          <div className="menu-sets">
            {group.map(set => (
              <div key={set.id} className="set-card-wrap">
                <button className="set-card" onClick={() => loadSet(set)}>
                  <span className="set-label">{set.label}</span>
                  <span className="set-count">{set.cardCount} kart</span>
                </button>
                <button
                  className="set-export-btn"
                  onClick={e => handleExport(e, set)}
                  title="Eksportuj zestaw (ZIP)"
                  aria-label="Eksportuj zestaw"
                >
                  ⇩
                </button>
                <button
                  className="set-delete-btn"
                  onClick={e => handleDelete(e, set)}
                  title="Usuń zestaw"
                  aria-label="Usuń zestaw"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="menu-divider">
        <span>zadania</span>
      </div>

      <div className="menu-section">
        <div className="menu-sets">
          <button className="set-card set-card-tasks" onClick={onTasks}>
            <span className="set-label">Algebra Boole'a</span>
            <span className="set-count">zadania otwarte</span>
          </button>
        </div>
      </div>

      <div className="menu-divider">
        <span>lub wczytaj własny plik</span>
      </div>

      <div
        className={`upload-zone${dragOver ? ' drag-over' : ''}`}
        onClick={() => fileRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); uploadFile(e.dataTransfer.files[0]) }}
      >
        <div className="upload-icon">📂</div>
        <p>{uploading ? 'Zapisuję…' : 'Kliknij lub przeciągnij plik JSON albo ZIP'}</p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.zip"
          style={{ display: 'none' }}
          disabled={uploading}
          onChange={e => uploadFile(e.target.files[0])}
        />
      </div>

      <div className="menu-divider">
        <span>generowanie własnego zestawu</span>
      </div>

      <div className="menu-section">
        <div className="menu-sets">
          <button className="set-card set-card-control" onClick={onDocs}>
            <span className="set-label">Format zestawu (dla LLM)</span>
            <span className="set-count">instrukcja + plik do pobrania</span>
          </button>
        </div>
      </div>
    </div>
  )
}
