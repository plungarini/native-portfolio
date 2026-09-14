// storagePersistence.ts
//
// Mirrors the account token between `location.hash` and `localStorage` so
// the app state is both shareable (URL) and durable across visits with no
// hash (bookmarks). Behavior per ARCHITECTURE.md §4 points 1-4:
//
//   1. On app start, if a hash token is present: decode it, use as initial
//      state, and mirror that same raw token into localStorage.
//   2. If no hash token is present: read localStorage, decode it, and
//      immediately rewrite it into `location.hash` so the URL is shareable
//      again.
//   3. On every state mutation: re-encode, then update both `location.hash`
//      (via `history.replaceState`) and `localStorage` synchronously.
//   4. A `decode()` failure falls back to the localStorage copy; if that
//      also fails, fall back to an empty `AppState`.

import { decode, encode, FORMAT_VERSION } from './accountCodec'
import { readTokenFromHash, writeTokenToHash } from './urlState'
import type { AppState } from '../../types/state'

export const STORAGE_KEY = 'portfolio.account'

function createEmptyState(): AppState {
  return { version: FORMAT_VERSION, mainCurrency: 'SOL', wallets: [] }
}

function readFromStorage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // localStorage may be unavailable (privacy mode, disabled, quota) — non-fatal
    return null
  }
}

function writeToStorage(token: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, token)
  } catch {
    // non-fatal: state still lives in the URL hash for this session
  }
}

/**
 * Compute the initial `AppState` for app start, per §4 points 1, 2 and 4.
 * Hash wins when both a hash token and a localStorage token are present.
 * Never throws — always resolves to some valid `AppState`.
 */
export function loadInitialState(): AppState {
  const hashToken = readTokenFromHash()

  if (hashToken !== null) {
    try {
      const state = decode(hashToken)
      // Hash wins: mirror it into localStorage so both stay in sync.
      writeToStorage(hashToken)
      return state
    } catch {
      // Corrupted/truncated hash token — fall through to localStorage (§4.4).
    }
  }

  const storedToken = readFromStorage()
  if (storedToken !== null) {
    try {
      const state = decode(storedToken)
      // Hash was absent or invalid — rewrite it from localStorage so the
      // URL becomes shareable again (§4.2), and so it self-heals from a
      // corrupted hash.
      writeTokenToHash(storedToken)
      return state
    } catch {
      // Corrupted localStorage copy too — fall through to empty state (§4.4).
    }
  }

  return createEmptyState()
}

/**
 * Persist a state mutation: re-encode, then update both `location.hash`
 * (via `history.replaceState`) and `localStorage` synchronously, per §4.3.
 */
export function persistState(state: AppState): void {
  const token = encode(state)
  writeTokenToHash(token)
  writeToStorage(token)
}
