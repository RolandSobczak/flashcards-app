import { Layers, CircleCheckBig, Boxes } from 'lucide-react'

// Pasek postępu rundy. Liczniki i pasek to dwa osobne wiersze — na wąskim
// ekranie pasek dostaje pełną szerokość zamiast resztki po licznikach,
// bo przy trzech licznikach zostawało mu kilkadziesiąt pikseli.
export default function StatsBar({ currentIdx, queueLength, chunkMode, chunkIndex, chunksCount, knownCount, totalCount }) {
  const progressPct = totalCount ? Math.round((knownCount / totalCount) * 100) : 0

  return (
    <div className="stats-bar">
      <div className="stats-chips">
        <div className="stat">
          <Layers size={15} aria-hidden="true" />
          Karta <strong>{Math.min(currentIdx + 1, queueLength)}</strong> / <strong>{queueLength}</strong>
        </div>
        {chunkMode && (
          <div className="stat stat-chunk">
            <Boxes size={15} aria-hidden="true" />
            Partia <strong>{chunkIndex + 1}</strong> / <strong>{chunksCount}</strong>
          </div>
        )}
        <div className="stat known">
          <CircleCheckBig size={15} aria-hidden="true" />
          Opanowane <strong>{knownCount}</strong> / <strong>{totalCount}</strong>
        </div>
      </div>
      <div
        className="progress-wrap"
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Opanowane ${knownCount} z ${totalCount}`}
      >
        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
    </div>
  )
}
