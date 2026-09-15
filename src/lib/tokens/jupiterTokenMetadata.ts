// Jupiter token metadata client (symbol / name / icon / verified / 24h change).
//
// Keyless, CORS-open, batched: `GET /tokens/v2/search?query=<mint1>,<mint2>,...`
// returns one entry per resolved mint. This is what lets the holdings table
// render a real symbol and logo instead of a raw mint address, and populate
// the "Price/24hΔ" column.
//
// Never throws: a failed lookup resolves to an empty map so callers fall back
// to the shortened-mint display, matching the never-throw fallback philosophy
// the rest of the data layer uses.

const JUPITER_TOKEN_SEARCH_URL = 'https://lite-api.jup.ag/tokens/v2/search'

/** Mints per request — the endpoint takes a comma-separated `query` list. */
const BATCH_SIZE = 50

export interface TokenMetadata {
  mint: string
  symbol: string
  name: string
  /** Absolute logo URL, or `null` when the token has no icon indexed. */
  iconUrl: string | null
  /** Jupiter's own verification flag — drives the check badge in the UI. */
  isVerified: boolean
  /** 24h price change as a percentage (e.g. `2.83` for +2.83%), or `null`. */
  priceChange24h: number | null
}

interface JupiterTokenSearchEntry {
  id?: string
  symbol?: string
  name?: string
  icon?: string
  isVerified?: boolean
  stats24h?: { priceChange?: number }
}

function parseEntry(entry: JupiterTokenSearchEntry): TokenMetadata | null {
  if (typeof entry.id !== 'string' || typeof entry.symbol !== 'string') return null
  const change = entry.stats24h?.priceChange
  return {
    mint: entry.id,
    symbol: entry.symbol,
    name: typeof entry.name === 'string' ? entry.name : entry.symbol,
    iconUrl: typeof entry.icon === 'string' ? entry.icon : null,
    isVerified: entry.isVerified === true,
    priceChange24h: typeof change === 'number' && Number.isFinite(change) ? change : null,
  }
}

async function fetchBatch(mints: string[]): Promise<TokenMetadata[]> {
  const url = `${JUPITER_TOKEN_SEARCH_URL}?query=${mints.join(',')}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Jupiter token search failed with HTTP ${response.status}`)
  }
  const body = (await response.json()) as JupiterTokenSearchEntry[]
  if (!Array.isArray(body)) return []
  return body.map(parseEntry).filter((t): t is TokenMetadata => t !== null)
}

/**
 * Metadata for a batch of Solana mints, keyed by mint address. Mints Jupiter
 * doesn't index are simply absent from the result. Returns `{}` for an empty
 * input without making a network call, and never rejects.
 */
export async function getTokenMetadata(
  mints: string[],
): Promise<Record<string, TokenMetadata>> {
  const unique = Array.from(new Set(mints.filter(Boolean)))
  if (unique.length === 0) return {}

  const batches: string[][] = []
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    batches.push(unique.slice(i, i + BATCH_SIZE))
  }

  const results = await Promise.all(
    batches.map((batch) => fetchBatch(batch).catch(() => [] as TokenMetadata[])),
  )

  const byMint: Record<string, TokenMetadata> = {}
  for (const token of results.flat()) {
    byMint[token.mint] = token
  }
  return byMint
}
