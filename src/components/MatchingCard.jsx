import { useState } from 'react'
import LatexContent from '../LatexContent'
import { useImageUrl, shuffle } from '../utils'

export default function MatchingCard({ card, matching, onKnow, onSkip }) {
  const [rightOrder, setRightOrder] = useState(() => shuffle(matching.pairs.map((_, i) => i)))
  const [checked, setChecked] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const imgUrl = useImageUrl(card.frontImage)
  const backImgUrl = useImageUrl(card.backImage)

  const revealed = checked || skipped
  const isAllCorrect = checked && rightOrder.every((v, i) => v === i)

  function moveUp(idx) {
    setRightOrder(prev => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  function moveDown(idx) {
    setRightOrder(prev => {
      const next = [...prev]
      ;[next[idx + 1], next[idx]] = [next[idx], next[idx + 1]]
      return next
    })
  }

  function handleSkipReveal() {
    setRightOrder(matching.pairs.map((_, i) => i))
    setSkipped(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card-face card-front" style={{ cursor: 'default' }}>
        <span className="card-label">Pytanie</span>
        <div className="card-content">
          <LatexContent text={card.front} />
        </div>
        {imgUrl && <img className="card-image" src={imgUrl} alt="Illustration" />}
      </div>

      <div className="matching-table">
        {matching.pairs.map(([leftLabel], i) => {
          const rightIdx = rightOrder[i]
          const rightLabel = matching.pairs[rightIdx][1]
          const rowCorrect = revealed && rightIdx === i
          const rowWrong = checked && rightIdx !== i
          return (
            <div
              key={i}
              className={`matching-row${rowCorrect ? ' match-correct' : rowWrong ? ' match-wrong' : ''}`}
            >
              <div className="matching-left"><LatexContent text={leftLabel} /></div>
              <div className="matching-sep">→</div>
              <div className="matching-right"><LatexContent text={rightLabel} /></div>
              {!revealed && (
                <div className="matching-controls">
                  <button className="matching-move-btn" onClick={() => moveUp(i)} disabled={i === 0}>↑</button>
                  <button className="matching-move-btn" onClick={() => moveDown(i)} disabled={i === rightOrder.length - 1}>↓</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {checked && (
        <div className={`result ${isAllCorrect ? 'result-correct' : 'result-wrong'}`}>
          {isAllCorrect ? '✓ Poprawnie!' : '✗ Niepoprawnie'}
        </div>
      )}

      {revealed && (
        <div className="card-face card-back" style={{ cursor: 'default', minHeight: 'auto', paddingTop: 24 }}>
          <span className="card-label">Wyjaśnienie</span>
          <div className="card-content" style={{ fontSize: 16, textAlign: 'left' }}>
            <LatexContent text={card.back} />
          </div>
          {backImgUrl && <img className="card-image" src={backImgUrl} alt="Back illustration" />}
        </div>
      )}

      <div className="card-actions">
        {revealed ? (
          <button
            className={isAllCorrect ? 'btn-know' : 'btn-skip'}
            onClick={isAllCorrect ? onKnow : onSkip}
          >
            Następne pytanie →
          </button>
        ) : (
          <>
            <button className="btn-skip" onClick={handleSkipReveal}>Jeszcze nie umiem</button>
            <button className="btn-primary" onClick={() => setChecked(true)}>Sprawdź</button>
          </>
        )}
      </div>
    </div>
  )
}
