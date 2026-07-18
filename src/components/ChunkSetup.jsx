import { CHUNK_THRESHOLD } from '../constants'
import { deleteSet, exportSet } from '../api'
import { clearSetProgress } from '../persistence'

export default function ChunkSetup({
  cardCount, chunkSize, onChangeSize, onStartChunked, onStartFull, resumable, onResume,
  setId, setLabel, onDeleted,
}) {
  const partCount = Math.ceil(cardCount / chunkSize)
  const partLabel = partCount === 1 ? 'partia' : 'partie/partii'

  async function handleExport() {
    try {
      const blob = await exportSet(setId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${setLabel || 'zestaw'}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert('Nie udało się wyeksportować zestawu.')
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Usunąć zestaw „${setLabel}”?`)) return
    try {
      await deleteSet(setId)
      clearSetProgress(setId)
      onDeleted()
    } catch {
      alert('Nie udało się usunąć zestawu.')
    }
  }

  return (
    <div className="chunk-setup">
      <div className="chunk-setup-info">
        <div className="chunk-setup-count">{cardCount} fiszek</div>
        <p className="chunk-setup-desc">
          {cardCount >= CHUNK_THRESHOLD ? 'Duży zestaw — ucz się partiami lub od razu całość.' : 'Gotowy do nauki.'}
        </p>
      </div>

      {resumable && (
        <div className="chunk-option-box chunk-option-resume">
          <div className="chunk-option-title">Kontynuuj poprzednie podejście</div>
          <div className="chunk-option-desc">
            Opanowano {resumable.knownIds.length} kart, w bieżącej rundzie zostało
            {' '}{Math.max(resumable.queue.length - resumable.currentIdx, 0)}.
          </div>
          <button className="btn-primary" onClick={onResume}>
            Kontynuuj
          </button>
        </div>
      )}

      {cardCount >= CHUNK_THRESHOLD && (
        <div className="chunk-option-box">
          <div className="chunk-option-title">Nauka partiami</div>
          <div className="chunk-option-desc">
            Po każdej partii przejdziesz do następnej.<br />
            Na końcu — pełny przegląd całego zestawu.
          </div>
          <div className="chunk-size-row">
            <span className="chunk-size-label">Rozmiar partii:</span>
            <div className="chunk-size-picker">
              <button onClick={() => onChangeSize(s => Math.max(5, s - 5))}>−</button>
              <span className="chunk-size-val">{chunkSize}</span>
              <button onClick={() => onChangeSize(s => Math.min(cardCount, s + 5))}>+</button>
            </div>
            <span className="chunk-size-meta">{partCount} {partLabel}</span>
          </div>
          <button className="btn-primary" onClick={onStartChunked}>
            Zacznij partiami
          </button>
        </div>
      )}

      <button className="btn-secondary chunk-full-btn" onClick={onStartFull}>
        Cały zestaw na raz ({cardCount} kart)
      </button>

      <div className="chunk-setup-manage">
        <button className="btn-secondary btn-small" onClick={handleExport}>
          Eksportuj zestaw (ZIP)
        </button>
        <button className="btn-danger btn-small" onClick={handleDelete}>
          Usuń zestaw
        </button>
      </div>
    </div>
  )
}
