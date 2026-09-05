import { useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import LatexContent from '../LatexContent'
import { useImageUrl, parseMCQ, getCorrectLetter } from '../utils'
import MCQCard from './MCQCard'
import MatchingCard from './MatchingCard'

function CardFace({ side, card }) {
  const imgUrl = useImageUrl(side === 'front' ? card.frontImage : card.backImage)

  return (
    <>
      <span className="card-label">{side === 'front' ? 'Pytanie' : 'Odpowiedź'}</span>
      <div className="card-content">
        <LatexContent text={side === 'front' ? card.front : card.back} />
      </div>
      {imgUrl && (
        <img
          className="card-image"
          src={imgUrl}
          alt={side === 'front' ? 'Front illustration' : 'Back illustration'}
        />
      )}
      {side === 'back' && card.symbols && (
        <ul className="card-symbols">
          {card.symbols.split(';').map((s, i) => (
            <li key={i}><LatexContent text={s.trim()} /></li>
          ))}
        </ul>
      )}
      {side === 'front' && <span className="flip-hint">kliknij, aby odwrócić</span>}
    </>
  )
}

export default function FlashCard({ card, onKnow, onSkip }) {
  const [flipped, setFlipped] = useState(false)
  const [animating, setAnimating] = useState(false)

  const mcq = parseMCQ(card.front)
  const correctLetter = mcq ? getCorrectLetter(card.back) : null

  if (card.matching) {
    return <MatchingCard card={card} matching={card.matching} onKnow={onKnow} onSkip={onSkip} />
  }

  if (mcq && correctLetter) {
    return <MCQCard card={card} mcq={mcq} correctLetter={correctLetter} onKnow={onKnow} onSkip={onSkip} />
  }

  function handleFlip() {
    if (animating) return
    setAnimating(true)
    setTimeout(() => {
      setFlipped(f => !f)
      setAnimating(false)
    }, 150)
  }

  function handleKnow() {
    setFlipped(false)
    onKnow()
  }

  function handleSkip() {
    setFlipped(false)
    onSkip()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        className={`card-face ${flipped ? 'card-back' : 'card-front'}${animating ? ' card-hiding' : ''}`}
        onClick={handleFlip}
      >
        <CardFace side={flipped ? 'back' : 'front'} card={card} />
      </div>

      <div className="card-actions">
        <button className="btn-skip" onClick={handleSkip}>
          <RotateCcw size={17} aria-hidden="true" />
          Jeszcze nie umiem
        </button>
        <button className="btn-know" onClick={handleKnow} disabled={!flipped}>
          <Check size={17} aria-hidden="true" />
          Umiem
        </button>
      </div>
    </div>
  )
}
