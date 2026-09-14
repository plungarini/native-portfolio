// Jupiter Price API v3 client (current Solana-side pricing), per ARCHITECTURE.md §3.3.
//
// Keyless, CORS-open. Used only for "current value" holdings display (§5.1)
// of Solana-side tokens where Jupiter has a price — never for historical
// PnL, and never for BSC-side tokens (those go through `defillama.ts`'s
// `getCurrentPrice` instead, per §3.3).

const JUPITER_PRICE_V3_URL = 'https://lite-api.jup.ag/price/v3'

interface JupiterPriceV3Entry {
  usdPrice: number
  blockId?: number
  decimals?: number
  priceChange24h?: number
}

type JupiterPriceV3Response = Record<string, JupiterPriceV3Entry>

/**
 * Current USD prices for a batch of Solana mint addresses, via
 * `GET /price/v3?ids=<mint1>,<mint2>,...` (§3.3). Returns a map from mint
 * address to USD price, omitting any mint Jupiter doesn't price (callers
 * should fall back to `defillama.ts`'s `getCurrentPrice` for those, per
 * §3.3). Returns `{}` for an empty input without making a network call.
 */
export async function getCurrentPricesJupiter(
  mintAddresses: string[],
): Promise<Record<string, number>> {
  if (mintAddresses.length === 0) {
    return {}
  }

  const url = `${JUPITER_PRICE_V3_URL}?ids=${mintAddresses.join(',')}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Jupiter Price API v3 request failed with HTTP ${response.status}`)
  }
  const body = (await response.json()) as JupiterPriceV3Response

  const prices: Record<string, number> = {}
  for (const mint of mintAddresses) {
    const entry = body[mint]
    if (entry && typeof entry.usdPrice === 'number') {
      prices[mint] = entry.usdPrice
    }
  }
  return prices
}
