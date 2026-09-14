// Fallback reader for /snapshots/prices-latest.json, per ARCHITECTURE.md §2/§3.3/§7.
//
// Used when DefiLlama/Jupiter are unreachable, for the fixed major-token
// watchlist committed by the scheduled `price-snapshot.yml` Action
// (`scripts/fetch-price-snapshot.ts`): SOL, BNB, USDC, USDT, JUP, CAKE,
// WBNB, WETH. Hard rule (§3.3): a token with no snapshot entry and no
// cache simply renders as "price unavailable" — this module never
// silently substitutes a different token's price or a current price for
// a historical one; a missing lookup resolves to `undefined`, and callers
// must surface that as "unavailable" rather than guessing.

/** Shape of one entry in `public/snapshots/prices-latest.json`'s `prices` map. */
export interface SnapshotPriceEntry {
  usd: number
  symbol: string
  coingeckoId: string
  timestamp: number
}

interface SnapshotFile {
  generatedAt: string
  prices: Record<string, SnapshotPriceEntry>
}

/** In-memory cache of the in-flight/completed snapshot fetch, so repeated
 * `getSnapshotPrice` calls don't re-fetch the same static JSON file. */
let snapshotPromise: Promise<SnapshotFile | null> | null = null

/** Builds the snapshot URL, respecting the Vite `base` path (e.g.
 * `/native-portfolio/snapshots/prices-latest.json` when deployed to
 * GitHub Pages under a repo-name subpath). */
function snapshotUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${normalizedBase}snapshots/prices-latest.json`
}

async function loadSnapshot(): Promise<SnapshotFile | null> {
  try {
    const response = await fetch(snapshotUrl())
    if (!response.ok) {
      return null
    }
    return (await response.json()) as SnapshotFile
  } catch {
    // Network error fetching the static asset itself — non-fatal, callers
    // treat this the same as "no snapshot entry for this symbol".
    return null
  }
}

/**
 * Resets the module-level cached snapshot fetch. Exposed for tests so each
 * test can start from a clean slate rather than reusing a previous test's
 * resolved/rejected fetch.
 */
export function resetSnapshotCache(): void {
  snapshotPromise = null
}

/**
 * Looks up `symbol` (e.g. `"SOL"`) in the committed price snapshot.
 * Returns `undefined` — never a wrong/substituted value — if the snapshot
 * itself is unreachable, or if `symbol` has no entry in it (e.g. an
 * obscure/long-tail token outside the fixed major-token watchlist).
 */
export async function getSnapshotPrice(
  symbol: string,
): Promise<SnapshotPriceEntry | undefined> {
  snapshotPromise ??= loadSnapshot()
  const snapshot = await snapshotPromise
  return snapshot?.prices[symbol.toUpperCase()]
}
