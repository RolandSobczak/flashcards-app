import { useRef, useState } from 'react'
import TasksView from '../TasksView'
import { BUILT_IN_SETS, CONTROL_SETS } from '../constants'

export default function Menu({ onData, onTasks }) {
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  function loadFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      try { onData(JSON.parse(e.target.result), file.name.replace(/\.json$/i, '')) }
      catch { alert('Nieprawidłowy plik JSON. Sprawdź format.') }
    }
    reader.readAsText(file)
  }

  async function loadBuiltIn(set) {
    try {
      const res = await fetch(set.file)
      onData(await res.json(), set.label)
    } catch {
      alert('Nie udało się wczytać zestawu.')
    }
  }

  return (
    <div className="menu">
      <div className="menu-section">
        <div className="menu-section-label">Buck-Boost i inne</div>
        <div className="menu-sets">
          {BUILT_IN_SETS.map(set => (
            <button key={set.file} className="set-card" onClick={() => loadBuiltIn(set)}>
              <span className="set-label">{set.label}</span>
              <span className="set-count">{set.cards} wzorów</span>
            </button>
          ))}
        </div>
      </div>

      <div className="menu-divider">
        <span>podstawy sterowania</span>
      </div>

      <div className="menu-section">
        <div className="menu-sets">
          {CONTROL_SETS.map(set => (
            <button key={set.file} className="set-card set-card-control" onClick={() => loadBuiltIn(set)}>
              <span className="set-label">{set.label}</span>
              <span className="set-count">{set.cards} fiszek</span>
            </button>
          ))}
        </div>
      </div>

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
        onDrop={e => { e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files[0]) }}
      >
        <div className="upload-icon">📂</div>
        <p>Kliknij lub przeciągnij plik JSON</p>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={e => loadFile(e.target.files[0])}
        />
      </div>
    </div>
  )
}
