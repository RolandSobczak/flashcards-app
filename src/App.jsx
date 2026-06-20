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
]

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

function FlashCard({ card, onKnow, onSkip }) {
  const [flipped, setFlipped] = useState(false)
  const [animating, setAnimating] = useState(false)

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

function RoundComplete({ total, knownCount, remainingCount, onNextRound, onReset }) {
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
  const [phase, setPhase] = useState('upload') // upload | study | roundDone | tasks
  const [setName, setSetName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

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
    setQueue(shuffle(normalized.map(c => c.id)))
    setCurrentIdx(0)
    setSetName(name)
    setPhase('study')
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
    const remaining = cards.filter(c => !knownIds.has(c.id)).map(c => c.id)
    setQueue(shuffle(remaining))
    setCurrentIdx(0)
    setPhase('study')
  }

  function handleReset() {
    setKnownIds(new Set())
    setQueue(shuffle(cards.map(c => c.id)))
    setCurrentIdx(0)
    setPhase('study')
  }

  function handleLoadNew() {
    setPhase('upload')
    setCards([])
    setKnownIds(new Set())
    setQueue([])
  }

  const cardById = id => cards.find(c => c.id === id)

  const progressPct = cards.length
    ? Math.round((knownIds.size / cards.length) * 100)
    : 0

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
          {phase !== 'upload' && phase !== 'tasks' && (
            <button className="btn-secondary" onClick={handleLoadNew}>
              Wczytaj nowe
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

      {phase !== 'upload' && phase !== 'tasks' && (
        <div className="stats-bar">
          <div className="stat">
            Karta <strong>{Math.min(currentIdx + 1, queue.length)}</strong> / <strong>{queue.length}</strong>
          </div>
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
          onNextRound={handleNextRound}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
