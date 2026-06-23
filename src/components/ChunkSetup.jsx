export default function ChunkSetup({ cardCount, chunkSize, onChangeSize, onStartChunked, onStartFull }) {
  const partCount = Math.ceil(cardCount / chunkSize)
  const partLabel = partCount === 1 ? 'partia' : 'partie/partii'

  return (
    <div className="chunk-setup">
      <div className="chunk-setup-info">
        <div className="chunk-setup-count">{cardCount} fiszek</div>
        <p className="chunk-setup-desc">Duży zestaw — ucz się partiami lub od razu całość.</p>
      </div>

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

      <button className="btn-secondary chunk-full-btn" onClick={onStartFull}>
        Cały zestaw na raz ({cardCount} kart)
      </button>
    </div>
  )
}
