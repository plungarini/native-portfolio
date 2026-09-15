// Permanent IndexedDB cache of each Solana wallet's derived transaction
// deltas, so a full history backfill only ever happens once per wallet —
// every subsequent load pages back only as far as the last-seen signature.
//
// IndexedDB rather than localStorage (the pattern `../../prices/
// historicalPriceCache.ts` uses) specifically because a real test against a
// heavily-active wallet blew localStorage's ~5MB per-origin quota on its
// first full backfill, and the safe response to a quota failure is to
// persist nothing at all (see the comment on `writeActivityCache` below) —
// which would leave that class of wallet permanently uncached. IndexedDB's
// quota is disk-space-based (typically hundreds of MB+), which actually
// fixes the problem instead of working around it.
//
// Deltas are cached rather than raw parsed transactions on purpose — a
// `TokenDelta[]` per signature is a handful of bytes; the raw RPC payload's
// `preTokenBalances`/`postTokenBalances` arrays are not, and there is
// nothing else about a transaction this app ever needs once its per-wallet
// deltas are known (classification into swap vs. one-sided transfer is a
// cheap, pure function of the deltas alone — see `deriveSwaps.ts`).

import type { TokenDelta } from './deriveSwaps'

const DB_NAME = 'native-portfolio'
const DB_VERSION = 2
const STORE_NAME = 'activityCache:v1:solana'

export interface CachedTxDeltas {
  signature: string
  blockTime: number
  deltas: TokenDelta[]
}

interface CacheEntry {
  newestSignature: string
  deltas: CachedTxDeltas[]
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
  return dbPromise
}

/**
 * Cached deltas for `address`, or `null` on a cold cache. Never throws —
 * IndexedDB may be unavailable (privacy mode, disabled) or the entry may be
 * missing/corrupted; either way this is just treated as a cold cache.
 */
export async function readActivityCache(address: string): Promise<CacheEntry | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(address)
      request.onsuccess = () => {
        const value: unknown = request.result
        if (
          typeof value === 'object' &&
          value !== null &&
          'newestSignature' in value &&
          'deltas' in value &&
          Array.isArray((value as CacheEntry).deltas)
        ) {
          resolve(value as CacheEntry)
        } else {
          resolve(null)
        }
      }
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/**
 * Persists `entry` for `address`. Non-fatal on any failure (quota, privacy
 * mode, IndexedDB disabled) — this round's in-memory data is already
 * accurate and already returned to the caller regardless; a failed write
 * just means the next load redoes a full (still accurate) backfill instead
 * of a cheap incremental one.
 */
export async function writeActivityCache(address: string, entry: CacheEntry): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(entry, address)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // non-fatal, see doc comment above
  }
}
