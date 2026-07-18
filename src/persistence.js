const STORAGE_KEY = 'flashcards:session:v1'
const SET_PROGRESS_KEY = 'flashcards:setProgress:v1'

export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return data && typeof data === 'object' ? data : null
  } catch {
    return null
  }
}

export function saveSession(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // storage full or unavailable — session continuity is best-effort
  }
}

function loadAllSetProgress() {
  try {
    const raw = localStorage.getItem(SET_PROGRESS_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw)
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

function saveAllSetProgress(all) {
  try {
    localStorage.setItem(SET_PROGRESS_KEY, JSON.stringify(all))
  } catch {
    // storage full or unavailable — resume is best-effort
  }
}

// Per-set study progress, keyed by backend set id, so switching between
// sets in the menu doesn't lose whatever round was in progress on each one.
export function loadSetProgress(setId) {
  if (setId == null) return null
  return loadAllSetProgress()[setId] ?? null
}

export function saveSetProgress(setId, progress) {
  if (setId == null) return
  const all = loadAllSetProgress()
  all[setId] = progress
  saveAllSetProgress(all)
}

export function clearSetProgress(setId) {
  if (setId == null) return
  const all = loadAllSetProgress()
  if (!(setId in all)) return
  delete all[setId]
  saveAllSetProgress(all)
}
