// Central auth state + token-aware fetch.
//
// The backend protects /api/exercises, /api/sets and /api/cards with a
// bearer token issued by /api/auth/verify. We keep the token (and the
// logged-in user) in localStorage so a refresh stays signed in, expose a
// tiny subscribe API so App can gate the UI, and wrap fetch so every
// protected call carries the token and a rejected token drops us back to
// the login screen.

const TOKEN_KEY = 'flashcards.authToken'
const USER_KEY = 'flashcards.authUser'

let token = localStorage.getItem(TOKEN_KEY)
let user = readStoredUser()
const listeners = new Set()

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || null
  } catch {
    return null
  }
}

export function getToken() {
  return token
}

export function getUser() {
  return user
}

// Snapshot subscription for useSyncExternalStore. The token string (or null)
// is a stable primitive, so React only re-renders when sign-in state flips.
export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify() {
  for (const listener of listeners) listener()
}

function setAuth(newToken, newUser) {
  token = newToken
  user = newUser
  localStorage.setItem(TOKEN_KEY, newToken)
  localStorage.setItem(USER_KEY, JSON.stringify(newUser))
  notify()
}

function clearAuth() {
  token = null
  user = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  notify()
}

async function detail(res) {
  try {
    return (await res.json()).detail
  } catch {
    return null
  }
}

// fetch that attaches the bearer token and, on a 401, clears the session so
// the app falls back to the login screen instead of showing a dead view.
export async function authFetch(url, options = {}) {
  const headers = new Headers(options.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) clearAuth()
  return res
}

export async function requestCode(email) {
  const res = await fetch('/api/auth/request-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) throw new Error((await detail(res)) || `HTTP ${res.status}`)
}

export async function verifyCode(email, code) {
  const res = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })
  if (!res.ok) throw new Error((await detail(res)) || `HTTP ${res.status}`)
  const data = await res.json()
  setAuth(data.token, data.user)
  return data
}

export async function logout() {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' })
  } finally {
    clearAuth()
  }
}
