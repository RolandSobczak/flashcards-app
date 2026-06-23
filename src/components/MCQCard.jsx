import { useState } from 'react'
import LatexContent from '../LatexContent'
import { useImageUrl } from '../utils'

export default function MCQCard({ card, mcq, correctLetter, onKnow, onSkip }) {
  const [selected, setSelected] = useState(null)
  const [skipped, setSkipped] = useState(false)
  const imgUrl = useImageUrl(card.frontImage)
  const backImgUrl = useImageUrl(card.backImage)

  const revealed = selected !== null || skipped
  const isCorrect = selected === correctLetter

  function handleOption(letter) {
    if (revealed) return
    setSelected(letter)
  }

  function handleKnow() {
    setSelected(null)
    setSkipped(false)
    onKnow()
  }

  function handleNext() {
    setSelected(null)
    setSkipped(false)
    onSkip()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card-face card-front" style={{ cursor: 'default' }}>
        <span className="card-label">Pytanie</span>
        <div className="card-content">
          <LatexContent text={mcq.question} />
        </div>
        {imgUrl && <img className="card-image" src={imgUrl} alt="Illustration" />}
      </div>

      <div className="mcq-options">
        {mcq.options.map(({ letter, text }) => {
          let cls = 'mcq-btn'
          if (revealed) {
            if (letter === correctLetter) cls += ' mcq-correct'
            else if (letter === selected) cls += ' mcq-wrong'
            else cls += ' mcq-dim'
          }
          return (
            <button key={letter} className={cls} onClick={() => handleOption(letter)} disabled={revealed}>
              <span className="mcq-letter">{letter})</span>
              <span className="mcq-text"><LatexContent text={text} /></span>
            </button>
          )
        })}
      </div>

      {revealed && (
        <>
          {selected !== null && (
            <div className={`result ${isCorrect ? 'result-correct' : 'result-wrong'}`}>
              {isCorrect ? '✓ Poprawnie!' : `✗ Niepoprawnie — prawidłowa odpowiedź: ${correctLetter})`}
            </div>
          )}
          <div className="card-face card-back" style={{ cursor: 'default', minHeight: 'auto', paddingTop: 24 }}>
            <span className="card-label">Wyjaśnienie</span>
            <div className="card-content" style={{ fontSize: 16, textAlign: 'left' }}>
              <LatexContent text={card.back} />
            </div>
            {card.backImage && <img className="card-image" src={backImgUrl} alt="Back illustration" />}
          </div>
        </>
      )}

      <div className="card-actions">
        {revealed ? (
          <button
            className={isCorrect ? 'btn-know' : 'btn-skip'}
            onClick={isCorrect ? handleKnow : handleNext}
          >
            Następne pytanie →
          </button>
        ) : (
          <>
            <button className="btn-skip" onClick={() => setSkipped(true)}>
              Jeszcze nie umiem
            </button>
            <button className="btn-know" disabled>
              Umiem ✓
            </button>
          </>
        )}
      </div>
    </div>
  )
}
