import LatexContent from '../LatexContent'
import { useImageUrl, parseMCQ, getCorrectLetter } from '../utils'

function BrowseCard({ card, index }) {
  const frontImgUrl = useImageUrl(card.frontImage)
  const backImgUrl = useImageUrl(card.backImage)
  const mcq = parseMCQ(card.front)
  const correctLetter = mcq ? getCorrectLetter(card.back) : null

  return (
    <div className="browse-card">
      <div className="browse-card-index">{index + 1}</div>
      <div className="browse-card-body">
        {card.matching ? (
          <>
            <div className="browse-card-front"><LatexContent text={card.front} /></div>
            {frontImgUrl && <img className="card-image" src={frontImgUrl} alt="" />}
            <ul className="browse-matching-list">
              {card.matching.pairs.map(([left, right], i) => (
                <li key={i}>
                  <LatexContent text={left} /> <span className="matching-sep">→</span> <LatexContent text={right} />
                </li>
              ))}
            </ul>
          </>
        ) : mcq && correctLetter ? (
          <>
            <div className="browse-card-front"><LatexContent text={mcq.question} /></div>
            {frontImgUrl && <img className="card-image" src={frontImgUrl} alt="" />}
            <ul className="browse-mcq-list">
              {mcq.options.map(({ letter, text }) => (
                <li key={letter} className={letter === correctLetter ? 'browse-mcq-correct' : ''}>
                  <span className="mcq-letter">{letter})</span> <LatexContent text={text} />
                </li>
              ))}
            </ul>
            <div className="browse-card-divider" />
            <div className="browse-card-back"><LatexContent text={card.back} /></div>
            {backImgUrl && <img className="card-image" src={backImgUrl} alt="" />}
          </>
        ) : (
          <>
            <div className="browse-card-front"><LatexContent text={card.front} /></div>
            {frontImgUrl && <img className="card-image" src={frontImgUrl} alt="" />}
            <div className="browse-card-divider" />
            <div className="browse-card-back"><LatexContent text={card.back} /></div>
            {backImgUrl && <img className="card-image" src={backImgUrl} alt="" />}
            {card.symbols && (
              <ul className="card-symbols">
                {card.symbols.split(';').map((s, i) => (
                  <li key={i}><LatexContent text={s.trim()} /></li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function BrowseView({ cards, onBack }) {
  return (
    <div className="browse-view">
      <div className="browse-toolbar">
        <button className="btn-back" onClick={onBack}>← Wróć</button>
        <span className="browse-count">{cards.length} kart</span>
      </div>
      <div className="browse-list">
        {cards.map((card, i) => (
          <BrowseCard key={card.id} card={card} index={i} />
        ))}
      </div>
    </div>
  )
}
