async function handle(res) {
  if (!res.ok) {
    let detail
    try { detail = (await res.json()).detail } catch { /* no json body */ }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return res.status === 204 ? null : res.json()
}

export function listSets() {
  return fetch('/api/sets').then(handle)
}

export function getSet(id) {
  return fetch(`/api/sets/${id}`).then(handle)
}

export function createSet(file, label, category) {
  const form = new FormData()
  form.append('file', file)
  form.append('label', label)
  if (category) form.append('category', category)
  return fetch('/api/sets', { method: 'POST', body: form }).then(handle)
}

export function deleteSet(id) {
  return fetch(`/api/sets/${id}`, { method: 'DELETE' }).then(handle)
}

export function updateCard(id, payload) {
  return fetch(`/api/cards/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(handle)
}
