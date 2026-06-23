export default function StatsBar({ currentIdx, queueLength, chunkMode, chunkIndex, chunksCount, knownCount, totalCount }) {
  const progressPct = totalCount ? Math.round((knownCount / totalCount) * 100) : 0

  return (
    <div className="stats-bar">
      <div className="stat">
        Karta <strong>{Math.min(currentIdx + 1, queueLength)}</strong> / <strong>{queueLength}</strong>
      </div>
      {chunkMode && (
        <div className="stat stat-chunk">
          Partia <strong>{chunkIndex + 1}</strong> / <strong>{chunksCount}</strong>
        </div>
      )}
      <div className="stat known">
        Opanowane <strong>{knownCount}</strong> / <strong>{totalCount}</strong>
      </div>
      <div style={{ flex: 1, minWidth: 80 }}>
        <div className="progress-wrap">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>
    </div>
  )
}
