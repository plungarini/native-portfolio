// DefiLlama Coins API client (historical + current price lookups), per ARCHITECTURE.md §3.3.
//
// Fully keyless, CORS-open, called directly from the browser. `coinId` is a
// DefiLlama "coin key": natives use `coingecko:solana` / `coingecko:binancecoin`,
// any SPL/BEP-20 token uses `{chain}:{contractAddress}` (`solana:<mint>` /
// `bsc:<address>`), per §3.3.
//
// Hard rule (§5): the *current* price functions here are used only for
// "current value" holdings display, never for historical PnL — every PnL
// figure uses `getHistoricalPrice`/`getDailyAveragePrice` instead.

const DEFILLAMA_BASE_URL = 'https://coins.llama.fi'

interface DefillamaCoinPrice {
  decimals?: number
  symbol?: string
  price: number
  timestamp: number
  confidence?: number
}

interface DefillamaPriceResponse {
  coins: Record<string, DefillamaCoinPrice>
}

interface DefillamaChartPoint {
  timestamp: number
  price: number
}

interface DefillamaChartCoin {
  symbol?: string
  confidence?: number
  decimals?: number
  prices: DefillamaChartPoint[]
}

interface DefillamaChartResponse {
  coins: Record<string, DefillamaChartCoin>
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`DefiLlama request failed with HTTP ${response.status}: ${url}`)
  }
  return (await response.json()) as T
}

/**
 * Current (live) USD price for `coinId`, via
 * `GET /prices/current/{coinId}` (§3.3). Used only for holdings display
 * (§5.1) — never for historical PnL. Returns `null` if DefiLlama has no
 * current price for this coin.
 */
export async function getCurrentPrice(coinId: string): Promise<number | null> {
  const url = `${DEFILLAMA_BASE_URL}/prices/current/${coinId}`
  const body = await fetchJson<DefillamaPriceResponse>(url)
  return body.coins[coinId]?.price ?? null
}

/**
 * Point-in-time USD price for `coinId` at `unixTimestamp`, via
 * `GET /prices/historical/{unixTimestamp}/{coinId}` (§3.3). Returns `null`
 * if DefiLlama has no historical price for this coin at this timestamp.
 */
export async function getHistoricalPrice(
  coinId: string,
  unixTimestamp: number,
): Promise<number | null> {
  const url = `${DEFILLAMA_BASE_URL}/prices/historical/${unixTimestamp}/${coinId}`
  const body = await fetchJson<DefillamaPriceResponse>(url)
  return body.coins[coinId]?.price ?? null
}

/**
 * Average of the 24 hourly USD prices for `coinId` over the UTC day
 * starting at `utcDayStartUnixTimestamp`, via
 * `GET /chart/{coinId}?start={utcDayStartUnixTimestamp}&span=24&period=1h`
 * (§3.3) — DefiLlama returns the raw hourly points, and the average is
 * computed client-side here. Used for the PnL calendar's day-level
 * USD→mainCurrency conversion rate (§5.2), never for a single trade's price.
 * Returns `null` if DefiLlama returns no hourly points for this coin/day.
 */
export async function getDailyAveragePrice(
  coinId: string,
  utcDayStartUnixTimestamp: number,
): Promise<number | null> {
  const url = `${DEFILLAMA_BASE_URL}/chart/${coinId}?start=${utcDayStartUnixTimestamp}&span=24&period=1h`
  const body = await fetchJson<DefillamaChartResponse>(url)
  const points = body.coins[coinId]?.prices
  if (!points || points.length === 0) {
    return null
  }
  const sum = points.reduce((total, point) => total + point.price, 0)
  return sum / points.length
}
