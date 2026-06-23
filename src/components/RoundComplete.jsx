export default function RoundComplete({
  total, knownCount, remainingCount,
  chunkMode, chunkIndex, chunksCount, chunkDone,
  chunkKnown, chunkRemaining, chunkTotal,
  onNextRound, onNextChunk, onReset,
}) {
  if (chunkMode && chunkDone) {
    const isLast = chunkIndex + 1 >= chunksCount
    return (
      <div className="round-complete">
        <div className="emoji">{isLast ? '🎓' : '✅'}</div>
        <h2>{isLast ? 'Wszystkie partie opanowane!' : `Partia ${chunkIndex + 1} opanowana!`}</h2>
        <p>
          {isLast
            ? `Opanowałeś wszystkie ${chunksCount} partie. Czas na pełny przegląd!`
            : `Przejdź do partii ${chunkIndex + 2} z ${chunksCount}. Łącznie opanowano ${knownCount}/${total}.`}
        </p>
        <div className="actions">
          {isLast
            ? <button className="btn-primary" onClick={onNextChunk}>Pełny zestaw ({total} kart)</button>
            : <button className="btn-primary" onClick={onNextChunk}>Partia {chunkIndex + 2} →</button>
          }
          <button className="btn-secondary" onClick={onReset}>Zacznij od nowa</button>
        </div>
      </div>
    )
  }

  if (chunkMode) {
    return (
      <div className="round-complete">
        <div className="emoji">✅</div>
        <h2>Koniec rundy — Partia {chunkIndex + 1}/{chunksCount}</h2>
        <p>Opanowano {chunkKnown} z {chunkTotal} w tej partii. Pozostało jeszcze {chunkRemaining}.</p>
        <div className="actions">
          <button className="btn-primary" onClick={onNextRound}>
            Następna runda ({chunkRemaining})
          </button>
          <button className="btn-secondary" onClick={onReset}>Zacznij od nowa</button>
        </div>
      </div>
    )
  }

  const allDone = remainingCount === 0
  return (
    <div className="round-complete">
      <div className="emoji">{allDone ? '🎉' : '✅'}</div>
      <h2>{allDone ? 'Wszystko opanowane!' : 'Koniec rundy'}</h2>
      <p>
        {allDone
          ? `Opanowałeś wszystkie ${total} fiszki!`
          : `Opanowano ${knownCount} z ${total}. Pozostało jeszcze ${remainingCount}.`}
      </p>
      <div className="actions">
        {!allDone && (
          <button className="btn-primary" onClick={onNextRound}>
            Następna runda ({remainingCount})
          </button>
        )}
        <button className="btn-secondary" onClick={onReset}>
          Zacznij od nowa
        </button>
      </div>
    </div>
  )
}
