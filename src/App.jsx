import { useEffect, useState } from 'react'
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
import { loadSession, saveSession } from './persistence'
import './App.css'

export default function App() {
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

  useEffect(() => {
    saveSession({
      cards, knownIds: Array.from(knownIds), queue, currentIdx, phase, setName,
      browseOrigin, chunkMode, chunkSize, chunks, chunkIndex,
    })
  }, [cards, knownIds, queue, currentIdx, phase, setName, browseOrigin, chunkMode, chunkSize, chunks, chunkIndex])

  function applyData(data, name = '') {
    const normalized = data.map((c, i) => ({
      id: c.id ?? i,
      front: c.front ?? c.question ?? '',
      back: c.back ?? c.answer ?? '',
      frontImage: c.frontImage ?? c.image ?? null,
      backImage: c.backImage ?? null,
      symbols: c.symbols ?? null,
      matching: c.matching ?? null,
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

  const currentChunkIds = chunkMode ? (chunks[chunkIndex] ?? []) : []
  const chunkKnown = currentChunkIds.filter(id => knownIds.has(id)).length
  const chunkRemaining = currentChunkIds.length - chunkKnown
  const chunkDone = chunkMode && chunkRemaining === 0

  const studyVisible = phase !== 'upload' && phase !== 'tasks' && phase !== 'docs' && phase !== 'chunkSetup' && phase !== 'browse'
  const hasLoadedSet = phase !== 'upload' && phase !== 'tasks' && phase !== 'docs' && cards.length > 0

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>Fiszki</h1>
          {phase !== 'upload' && phase !== 'tasks' && phase !== 'docs' && setName && (
            <div className="set-name">{setName}</div>
          )}
        </div>
        <div className="header-actions">
          {hasLoadedSet && phase !== 'browse' && (
            <button className="btn-secondary" onClick={openBrowse}>Wszystkie karty</button>
          )}
          {studyVisible && (
            <button className="btn-secondary" onClick={handleLoadNew}>Wczytaj nowe</button>
          )}
          {phase === 'chunkSetup' && (
            <button className="btn-secondary" onClick={handleLoadNew}>← Menu</button>
          )}
        </div>
      </div>

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
