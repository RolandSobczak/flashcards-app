import { useEffect, useState, useSyncExternalStore } from 'react'
import { LayoutGrid, ArrowLeft, LogOut } from 'lucide-react'
import Login from './Login'
import { subscribe, getToken, getUser, logout } from './auth'
import TasksView from './TasksView'
import Menu from './components/Menu'
import ChunkSetup from './components/ChunkSetup'
import StatsBar from './components/StatsBar'
import FlashCard from './components/FlashCard'
import RoundComplete from './components/RoundComplete'
import BrowseView from './components/BrowseView'
import FormatDocsView from './components/FormatDocsView'
import { shuffle } from './utils'
import { CHUNK_THRESHOLD } from './constants'
import { loadSession, saveSession, loadSetProgress, saveSetProgress } from './persistence'
import './App.css'

// Turns a saved per-set progress blob into a resume-ready shape, dropping
// references to cards that no longer exist and refusing to offer a resume
// for a round that hasn't actually started or is already fully cleared.
function computeResumable(saved, cards) {
  if (!saved || !Array.isArray(saved.queue)) return null

  const validIds = new Set(cards.map(c => c.id))
  const queue = saved.queue.filter(id => validIds.has(id))
  if (queue.length === 0) return null

  const knownIds = (saved.knownIds ?? []).filter(id => validIds.has(id))
  const inProgress = knownIds.length > 0 || (saved.currentIdx ?? 0) > 0
  if (!inProgress) return null
  if (!saved.chunkMode && knownIds.length >= cards.length) return null

  const chunks = Array.isArray(saved.chunks)
    ? saved.chunks.map(chunk => chunk.filter(id => validIds.has(id))).filter(chunk => chunk.length > 0)
    : []

  return {
    knownIds,
    queue,
    currentIdx: Math.min(saved.currentIdx ?? 0, queue.length - 1),
    chunkMode: !!saved.chunkMode,
    chunkSize: saved.chunkSize ?? 10,
    chunks,
    chunkIndex: Math.min(saved.chunkIndex ?? 0, Math.max(chunks.length - 1, 0)),
    phase: saved.phase === 'roundDone' ? 'roundDone' : 'study',
  }
}

export default function App() {
  const token = useSyncExternalStore(subscribe, getToken)
  const user = getUser()

  const [persisted] = useState(loadSession)

  const [cards, setCards] = useState(persisted?.cards ?? [])
  const [knownIds, setKnownIds] = useState(() => new Set(persisted?.knownIds ?? []))
  const [queue, setQueue] = useState(persisted?.queue ?? [])
  const [currentIdx, setCurrentIdx] = useState(persisted?.currentIdx ?? 0)
  const [phase, setPhase] = useState(persisted?.phase ?? 'upload') // upload | chunkSetup | study | roundDone | tasks | browse | docs
  const [setName, setSetName] = useState(persisted?.setName ?? '')
  const [browseOrigin, setBrowseOrigin] = useState(persisted?.browseOrigin ?? 'study')

  const [chunkMode, setChunkMode] = useState(persisted?.chunkMode ?? false)
  const [chunkSize, setChunkSize] = useState(persisted?.chunkSize ?? 10)
  const [chunks, setChunks] = useState(persisted?.chunks ?? [])
  const [chunkIndex, setChunkIndex] = useState(persisted?.chunkIndex ?? 0)
  const [currentSetId, setCurrentSetId] = useState(persisted?.currentSetId ?? null)
  const [pendingResume, setPendingResume] = useState(null)

  useEffect(() => {
    saveSession({
      cards, knownIds: Array.from(knownIds), queue, currentIdx, phase, setName,
      browseOrigin, chunkMode, chunkSize, chunks, chunkIndex, currentSetId,
    })
  }, [cards, knownIds, queue, currentIdx, phase, setName, browseOrigin, chunkMode, chunkSize, chunks, chunkIndex, currentSetId])

  // Keeps each backend set's own round progress around (separately from the
  // page-refresh session above) so leaving to the menu and coming back to
  // the same set can offer to pick up where it was left off.
  useEffect(() => {
    if (currentSetId == null) return
    if (phase !== 'study' && phase !== 'roundDone') return
    saveSetProgress(currentSetId, {
      knownIds: Array.from(knownIds), queue, currentIdx,
      chunkMode, chunkSize, chunks, chunkIndex, phase,
    })
  }, [currentSetId, phase, knownIds, queue, currentIdx, chunkMode, chunkSize, chunks, chunkIndex])

  function applyData(data, name = '', setId = null) {
    const normalized = data.map((c, i) => ({
      id: c.id ?? i,
      front: c.front ?? c.question ?? '',
      back: c.back ?? c.answer ?? '',
      frontImage: c.frontImage ?? c.image ?? null,
      backImage: c.backImage ?? null,
      symbols: c.symbols ?? null,
      matching: c.matching ?? null,
    }))
    const resumable = computeResumable(setId != null ? loadSetProgress(setId) : null, normalized)

    setCards(normalized)
    setSetName(name)
    setCurrentSetId(setId)
    setKnownIds(new Set())
    setChunkMode(false)
    setChunks([])
    setChunkIndex(0)
    setPendingResume(resumable)

    // Sets loaded from the backend always land on the details screen first
    // (it's also where export/delete live now); only a setId-less call
    // (shouldn't normally happen) falls back to the old size-based skip.
    if (setId != null || resumable || normalized.length >= CHUNK_THRESHOLD) {
      setPhase('chunkSetup')
    } else {
      setQueue(shuffle(normalized.map(c => c.id)))
      setCurrentIdx(0)
      setPhase('study')
    }
  }

  function handleResume() {
    if (!pendingResume) return
    const r = pendingResume
    setKnownIds(new Set(r.knownIds))
    setQueue(r.queue)
    setCurrentIdx(r.currentIdx)
    setChunkMode(r.chunkMode)
    setChunkSize(r.chunkSize)
    setChunks(r.chunks)
    setChunkIndex(r.chunkIndex)
    setPendingResume(null)
    setPhase(r.phase)
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
    setPendingResume(null)
    setPhase('study')
  }

  function startFullStudy() {
    setChunkMode(false)
    setChunks([])
    setKnownIds(new Set())
    setQueue(shuffle(cards.map(c => c.id)))
    setCurrentIdx(0)
    setPendingResume(null)
    setPhase('study')
  }

  function handleNextChunk() {
    const next = chunkIndex + 1
    if (next >= chunks.length) {
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
      setKnownIds(new Set())
      setChunkMode(false)
      setChunks([])
      setChunkIndex(0)
      setPhase('chunkSetup')
    } else {
      setKnownIds(new Set())
      setQueue(shuffle(cards.map(c => c.id)))
      setCurrentIdx(0)
      setPhase('study')
    }
  }

  function openBrowse() {
    setBrowseOrigin(phase)
    setPhase('browse')
  }

  function closeBrowse() {
    setPhase(browseOrigin)
  }

  function handleCardUpdated(updated) {
    setCards(prev => prev.map(c => (c.id === updated.id ? { ...c, ...updated } : c)))
  }

  function handleBackToMenu() {
    // Per-set progress is already persisted continuously (see the effect
    // above), so clearing the in-memory view here doesn't lose it — picking
    // the same set again from the menu can still offer to resume it.
    setPhase('upload')
    setCards([])
    setKnownIds(new Set())
    setQueue([])
    setChunkMode(false)
    setChunks([])
    setChunkIndex(0)
    setCurrentSetId(null)
    setPendingResume(null)
  }

  const cardById = id => cards.find(c => c.id === id)

  const currentChunkIds = chunkMode ? (chunks[chunkIndex] ?? []) : []
  const chunkKnown = currentChunkIds.filter(id => knownIds.has(id)).length
  const chunkRemaining = currentChunkIds.length - chunkKnown
  const chunkDone = chunkMode && chunkRemaining === 0

  const studyVisible = phase !== 'upload' && phase !== 'tasks' && phase !== 'docs' && phase !== 'chunkSetup' && phase !== 'browse'
  const hasLoadedSet = phase !== 'upload' && phase !== 'tasks' && phase !== 'docs' && cards.length > 0

  // Gate the whole app behind a session. A missing/expired token (the latter
  // cleared by authFetch on a 401) drops back here to the login screen.
  if (!token) return <Login />

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <h1>Fiszki</h1>
          {phase !== 'upload' && phase !== 'tasks' && phase !== 'docs' && setName && (
            <div className="set-name">{setName}</div>
          )}
        </div>
        {/* Etykiety chowają się poniżej 640 px (patrz .btn-label w App.css),
            więc na telefonie zostają same ikony i pasek mieści się w jednym
            rzędzie zamiast zawijać na trzy. */}
        <nav className="header-actions">
          {hasLoadedSet && phase !== 'browse' && (
            <button className="btn-secondary btn-icon" onClick={openBrowse} title="Wszystkie karty" aria-label="Wszystkie karty">
              <LayoutGrid size={17} aria-hidden="true" />
              <span className="btn-label">Wszystkie karty</span>
            </button>
          )}
          {(studyVisible || phase === 'chunkSetup') && (
            <button className="btn-secondary btn-icon" onClick={handleBackToMenu} title="Wróć do menu" aria-label="Wróć do menu">
              <ArrowLeft size={17} aria-hidden="true" />
              <span className="btn-label">Menu</span>
            </button>
          )}
          {user && (
            <span className="user-badge" title={user.email}>
              <span className="user-avatar" aria-hidden="true">{user.email.slice(0, 1).toUpperCase()}</span>
              <span className="user-email">{user.email}</span>
            </span>
          )}
          <button className="btn-secondary btn-icon" onClick={logout} title="Wyloguj" aria-label="Wyloguj">
            <LogOut size={17} aria-hidden="true" />
            <span className="btn-label">Wyloguj</span>
          </button>
        </nav>
      </header>

      {phase === 'upload' && (
        <Menu onData={applyData} onTasks={() => setPhase('tasks')} onDocs={() => setPhase('docs')} />
      )}

      {phase === 'tasks' && (
        <TasksView onBack={() => setPhase('upload')} />
      )}

      {phase === 'docs' && (
        <FormatDocsView onBack={() => setPhase('upload')} />
      )}

      {phase === 'browse' && (
        <BrowseView cards={cards} onBack={closeBrowse} onCardUpdated={handleCardUpdated} />
      )}

      {phase === 'chunkSetup' && (
        <ChunkSetup
          cardCount={cards.length}
          chunkSize={chunkSize}
          onChangeSize={setChunkSize}
          onStartChunked={startChunkedStudy}
          onStartFull={startFullStudy}
          resumable={pendingResume}
          onResume={handleResume}
          setId={currentSetId}
          setLabel={setName}
          onDeleted={handleBackToMenu}
        />
      )}

      {studyVisible && (
        <StatsBar
          currentIdx={currentIdx}
          queueLength={queue.length}
          chunkMode={chunkMode}
          chunkIndex={chunkIndex}
          chunksCount={chunks.length}
          knownCount={knownIds.size}
          totalCount={cards.length}
        />
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
