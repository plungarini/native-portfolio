// urlState.ts
//
// Reads/writes the account token to/from `location.hash` under the
// single-letter key `a`: `https://<host>/#a=<token>`. Per ARCHITECTURE.md
// §4 point 3: writes always go through `history.replaceState` — never
// `history.pushState` — so updating state never creates a history entry
// or reloads the page.

const HASH_KEY = 'a'

/**
 * Read the account token out of `location.hash`, if present.
 * Returns `null` when there is no hash, or no `a=` entry in it.
 */
export function readTokenFromHash(): string | null {
  const hash = window.location.hash
  if (!hash || hash === '#') return null

  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  const token = params.get(HASH_KEY)
  return token && token.length > 0 ? token : null
}

/**
 * Write `token` into `location.hash` as `#a=<token>`, replacing the
 * current history entry (no reload, no new history-stack entry).
 */
export function writeTokenToHash(token: string): void {
  const url = new URL(window.location.href)
  url.hash = `${HASH_KEY}=${token}`
  window.history.replaceState(window.history.state, '', url)
}
