import { useState, useRef } from 'react'
import LatexContent from './LatexContent'
import TasksView from './TasksView'
import './App.css'

const BUILT_IN_SETS = [
  { label: 'CCM — konwersja i prądy', file: '/buck_boost_1_ccm.json', cards: 10 },
  { label: 'DCM — granice i zmienne', file: '/buck_boost_2_dcm.json', cards: 11 },
  { label: 'Straty — tryb Buck', file: '/buck_boost_3_straty_buck.json', cards: 10 },
  { label: 'Straty — tryb Buck-Boost', file: '/buck_boost_4_straty_bbm.json', cards: 10 },
  { label: 'Dynamika pętli', file: '/buck_boost_5_dynamika.json', cards: 9 },
  { label: 'Kompensator i Soft-Start', file: '/buck_boost_6_kompensator.json', cards: 5 },
  { label: 'Zadania 1 i 2', file: '/buck_boost_zadania_1_2.json', cards: 8 },
  { label: 'BBM — wzory kluczowe', file: '/buck_boost_bbm_kluczowe.json', cards: 8 },
  { label: 'printf — specyfikatory formatu', file: '/printf_specifiers.json', cards: 22 },
]

const CONTROL_SETS = [
  { label: 'Transformata Laplace\'a i Z', file: '/control_1_laplace.json', cards: 12 },
  { label: 'Transmitancja i schematy blokowe', file: '/control_2_transmitancja.json', cards: 10 },
  { label: 'Charakterystyki Bodego i Nicholsa', file: '/control_3_bode.json', cards: 9 },
  { label: 'Stabilność — Nyquist, Hurwitz, Jury', file: '/control_4_stabilnosc.json', cards: 8 },
  { label: 'Pierwiastkowe miejsce geometryczne', file: '/control_5_pmg.json', cards: 9 },
  { label: 'Jakość regulacji i odpowiedzi skokowe', file: '/control_6_jakosc.json', cards: 11 },
  { label: 'Regulatory P/PI/PID', file: '/control_7_regulatory.json', cards: 8 },
  { label: 'Układy nieliniowe i rozmyte', file: '/control_8_nieliniowe.json', cards: 8 },
  { label: 'Przestrzeń stanu', file: '/control_9_przestrzen.json', cards: 4 },
  { label: 'Układy dyskretne', file: '/control_10_dyskretne.json', cards: 14 },
  { label: 'Zadania egzaminacyjne (Z1–Z74)', file: '/control_zadania.json', cards: 74 },
]

const CHUNK_THRESHOLD = 30

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function useImageUrl(src) {
  // src can be a URL string or a base64 string embedded in JSON
  if (!src) return null
  if (src.startsWith('data:') || src.startsWith('http') || src.startsWith('/') || src.startsWith('./')) {
    return src
  }
  // treat as base64 PNG if no prefix
  return `data:image/png;base64,${src}`
}

function parseMCQ(front) {
  const lines = front.split('\n')
  const optionRe = /^([a-d])\)\s*(.+)$/
  const options = []
  const questionLines = []

  for (const line of lines) {
    const m = line.trim().match(optionRe)
    if (m) {
      options.push({ letter: m[1], text: m[2] })
    } else if (options.length === 0 && line.trim()) {
      questionLines.push(line)
    }
  }

  if (options.length < 2) return null
  return { question: questionLines.join('\n').trim(), options }
}

function getCorrectLetter(back) {
  const m = back.match(/^\*\*([a-d])\)/)
  return m ? m[1] : null
}

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

function MCQCard({ card, mcq, correctLetter, onKnow, onSkip }) {
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
        {imgUrl && (
          <img className="card-image" src={imgUrl} alt="Illustration" />
        )}
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
            {card.backImage && (
              <img className="card-image" src={backImgUrl} alt="Back illustration" />
            )}
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

function MatchingCard({ card, matching, onKnow, onSkip }) {
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
            <div key={i} className={`matching-row${rowCorrect ? ' match-correct' : rowWrong ? ' match-wrong' : ''}`}>
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

function FlashCard({ card, onKnow, onSkip }) {
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
          Jeszcze nie umiem
        </button>
        <button className="btn-know" onClick={handleKnow} disabled={!flipped}>
          Umiem ✓
        </button>
      </div>
    </div>
  )
}

function RoundComplete({
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

export default function App() {
  const [cards, setCards] = useState([])
  const [knownIds, setKnownIds] = useState(new Set())
  const [queue, setQueue] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [phase, setPhase] = useState('upload') // upload | chunkSetup | study | roundDone | tasks
  const [setName, setSetName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  const [chunkMode, setChunkMode] = useState(false)
  const [chunkSize, setChunkSize] = useState(10)
  const [chunks, setChunks] = useState([])     // array of card-ID arrays
  const [chunkIndex, setChunkIndex] = useState(0)

  function applyData(data, name = '') {
    const normalized = data.map((c, i) => ({
      id: c.id ?? i,
      front: c.front ?? c.question ?? '',
      back: c.back ?? c.answer ?? '',
      frontImage: c.frontImage ?? c.image ?? null,
      backImage: c.backImage ?? null,
      symbols: c.symbols ?? null,
    }))
    setCards(normalized)
    setKnownIds(new Set())
    setChunkMode(false)
    setChunks([])
    setChunkIndex(0)
    setSetName(name)
    if (normalized.length >= CHUNK_THRESHOLD) {
      setPhase('chunkSetup')
    } else {
      setQueue(shuffle(normalized.map(c => c.id)))
      setCurrentIdx(0)
      setPhase('study')
    }
  }

  function buildChunks(cardList, size) {
    const ids = cardList.map(c => c.id)
    const result = []
    for (let i = 0; i < ids.length; i += size) result.push(ids.slice(i, i + size))
    return result
  }

  function startChunkedStudy() {
    const newChunks = buildChunks(cards, chunkSize)
    setChunks(newChunks)
    setChunkIndex(0)
    setChunkMode(true)
    setKnownIds(new Set())
    setQueue(shuffle(newChunks[0]))
    setCurrentIdx(0)
    setPhase('study')
  }

  function startFullStudy() {
    setChunkMode(false)
    setChunks([])
    setKnownIds(new Set())
    setQueue(shuffle(cards.map(c => c.id)))
    setCurrentIdx(0)
    setPhase('study')
  }

  function handleNextChunk() {
    const next = chunkIndex + 1
    if (next >= chunks.length) {
      // All chunks done — start full review with reset
      setChunkMode(false)
      setKnownIds(new Set())
      setQueue(shuffle(cards.map(c => c.id)))
      setCurrentIdx(0)
      setPhase('study')
    } else {
      setChunkIndex(next)
      setQueue(shuffle(chunks[next]))
      setCurrentIdx(0)
      setPhase('study')
    }
  }

  function loadFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      try { applyData(JSON.parse(e.target.result), file.name.replace(/\.json$/i, '')) }
      catch { alert('Nieprawidłowy plik JSON. Sprawdź format.') }
    }
    reader.readAsText(file)
  }

  async function loadBuiltIn(set) {
    try {
      const res = await fetch(set.file)
      applyData(await res.json(), set.label)
    } catch {
      alert('Nie udało się wczytać zestawu.')
    }
  }

  function handleFileInput(e) {
    loadFile(e.target.files[0])
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    loadFile(e.dataTransfer.files[0])
  }

  function handleKnow() {
    const cardId = queue[currentIdx]
    const newKnown = new Set([...knownIds, cardId])
    setKnownIds(newKnown)
    advance(newKnown, queue, currentIdx)
  }

  function handleSkip() {
    advance(knownIds, queue, currentIdx)
  }

  function advance(_known, q, idx) {
    const next = idx + 1
    if (next >= q.length) {
      setPhase('roundDone')
    } else {
      setCurrentIdx(next)
    }
  }

  function handleNextRound() {
    if (chunkMode) {
      const remaining = chunks[chunkIndex].filter(id => !knownIds.has(id))
      setQueue(shuffle(remaining))
    } else {
      setQueue(shuffle(cards.filter(c => !knownIds.has(c.id)).map(c => c.id)))
    }
    setCurrentIdx(0)
    setPhase('study')
  }

  function handleReset() {
    if (chunkMode) {
      setPhase('chunkSetup')
      setKnownIds(new Set())
      setChunkMode(false)
      setChunks([])
      setChunkIndex(0)
    } else {
      setKnownIds(new Set())
      setQueue(shuffle(cards.map(c => c.id)))
      setCurrentIdx(0)
      setPhase('study')
    }
  }

  function handleLoadNew() {
    setPhase('upload')
    setCards([])
    setKnownIds(new Set())
    setQueue([])
    setChunkMode(false)
    setChunks([])
    setChunkIndex(0)
  }

  const cardById = id => cards.find(c => c.id === id)

  const progressPct = cards.length
    ? Math.round((knownIds.size / cards.length) * 100)
    : 0

  const currentChunkIds = chunkMode ? (chunks[chunkIndex] ?? []) : []
  const chunkKnown = currentChunkIds.filter(id => knownIds.has(id)).length
  const chunkRemaining = currentChunkIds.length - chunkKnown
  const chunkDone = chunkMode && chunkRemaining === 0

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>Fiszki</h1>
          {phase !== 'upload' && phase !== 'tasks' && setName && (
            <div className="set-name">{setName}</div>
          )}
        </div>
        <div className="header-actions">
          {phase !== 'upload' && phase !== 'tasks' && phase !== 'chunkSetup' && (
            <button className="btn-secondary" onClick={handleLoadNew}>
              Wczytaj nowe
            </button>
          )}
          {phase === 'chunkSetup' && (
            <button className="btn-secondary" onClick={handleLoadNew}>
              ← Menu
            </button>
          )}
        </div>
      </div>

      {phase === 'upload' && (
        <div className="menu">
          <div className="menu-section">
            <div className="menu-section-label">Buck-Boost i inne</div>
            <div className="menu-sets">
              {BUILT_IN_SETS.map(set => (
                <button
                  key={set.file}
                  className="set-card"
                  onClick={() => loadBuiltIn(set)}
                >
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
                <button
                  key={set.file}
                  className="set-card set-card-control"
                  onClick={() => loadBuiltIn(set)}
                >
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
              <button className="set-card set-card-tasks" onClick={() => setPhase('tasks')}>
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
            onDrop={handleDrop}
          >
            <div className="upload-icon">📂</div>
            <p>Kliknij lub przeciągnij plik JSON</p>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
          </div>
        </div>
      )}

      {phase === 'tasks' && (
        <TasksView onBack={() => setPhase('upload')} />
      )}

      {phase === 'chunkSetup' && (
        <div className="chunk-setup">
          <div className="chunk-setup-info">
            <div className="chunk-setup-count">{cards.length} fiszek</div>
            <p className="chunk-setup-desc">Duży zestaw — ucz się partiami lub od razu całość.</p>
          </div>

          <div className="chunk-option-box">
            <div className="chunk-option-title">Nauka partiami</div>
            <div className="chunk-option-desc">Po każdej partii przejdziesz do następnej.<br/>Na końcu — pełny przegląd całego zestawu.</div>
            <div className="chunk-size-row">
              <span className="chunk-size-label">Rozmiar partii:</span>
              <div className="chunk-size-picker">
                <button onClick={() => setChunkSize(s => Math.max(5, s - 5))}>−</button>
                <span className="chunk-size-val">{chunkSize}</span>
                <button onClick={() => setChunkSize(s => Math.min(cards.length, s + 5))}>+</button>
              </div>
              <span className="chunk-size-meta">
                {Math.ceil(cards.length / chunkSize)} {Math.ceil(cards.length / chunkSize) === 1 ? 'partia' : 'partie/partii'}
              </span>
            </div>
            <button className="btn-primary" onClick={startChunkedStudy}>
              Zacznij partiami
            </button>
          </div>

          <button className="btn-secondary chunk-full-btn" onClick={startFullStudy}>
            Cały zestaw na raz ({cards.length} kart)
          </button>
        </div>
      )}

      {phase !== 'upload' && phase !== 'tasks' && phase !== 'chunkSetup' && (
        <div className="stats-bar">
          <div className="stat">
            Karta <strong>{Math.min(currentIdx + 1, queue.length)}</strong> / <strong>{queue.length}</strong>
          </div>
          {chunkMode && (
            <div className="stat stat-chunk">
              Partia <strong>{chunkIndex + 1}</strong> / <strong>{chunks.length}</strong>
            </div>
          )}
          <div className="stat known">
            Opanowane <strong>{knownIds.size}</strong> / <strong>{cards.length}</strong>
          </div>
          <div style={{ flex: 1, minWidth: 80 }}>
            <div className="progress-wrap">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      )}

      {phase === 'study' && queue.length > 0 && currentIdx < queue.length && (
        <FlashCard
          key={queue[currentIdx]}
          card={cardById(queue[currentIdx])}
          onKnow={handleKnow}
          onSkip={handleSkip}
        />
      )}

      {phase === 'roundDone' && (
        <RoundComplete
          total={cards.length}
          knownCount={knownIds.size}
          remainingCount={cards.length - knownIds.size}
          chunkMode={chunkMode}
          chunkIndex={chunkIndex}
          chunksCount={chunks.length}
          chunkDone={chunkDone}
          chunkKnown={chunkKnown}
          chunkRemaining={chunkRemaining}
          chunkTotal={currentChunkIds.length}
          onNextRound={handleNextRound}
          onNextChunk={handleNextChunk}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
