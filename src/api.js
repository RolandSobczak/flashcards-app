import { authFetch } from './auth'

async function handle(res) {
  if (!res.ok) {
    let detail
    try { detail = (await res.json()).detail } catch { /* no json body */ }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return res.status === 204 ? null : res.json()
}

export function listSets() {
  return authFetch('/api/sets').then(handle)
}

export function getSet(id) {
  return authFetch(`/api/sets/${id}`).then(handle)
}

export function createSet(file, label, category) {
  const form = new FormData()
  form.append('file', file)
  form.append('label', label)
  if (category) form.append('category', category)
  return authFetch('/api/sets', { method: 'POST', body: form }).then(handle)
}

export function deleteSet(id) {
  return authFetch(`/api/sets/${id}`, { method: 'DELETE' }).then(handle)
}

// The export endpoint is bearer-protected, so it can't be reached with a
// plain <a href> download (a browser navigation won't send the token). Pull
// it as an authenticated blob instead and hand back an object URL the caller
// can trigger a download from.
export async function exportSet(id) {
  const res = await authFetch(`/api/sets/${id}/export`)
  if (!res.ok) {
    let detail
    try { detail = (await res.json()).detail } catch { /* not json */ }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return res.blob()
}

export function updateCard(id, payload) {
  return authFetch(`/api/cards/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(handle)
}
