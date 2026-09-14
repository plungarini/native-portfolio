// Permanent localStorage historical price cache keyed by (coinId, hour), per ARCHITECTURE.md §3.3/§7.
//
// Historical prices never change once fetched, so a cache hit here never
// re-fetches — this both protects against future rate limiting on
// DefiLlama's free API and avoids redundant calls entirely (§3.3). Only
// successfully-resolved prices are cached; a `null` (no price found) or a
// thrown network error is never cached, so a transient outage doesn't
// permanently poison the cache.

import { getDailyAveragePrice, getHistoricalPrice } from './defillama'

const CACHE_PREFIX = 'priceCache:v1'
const SECONDS_PER_HOUR = 3600

/** Rounds a unix timestamp down to the start of its hour, per §3.3's cache key spec. */
function roundToHour(unixTimestamp: number): number {
  return Math.floor(unixTimestamp / SECONDS_PER_HOUR) * SECONDS_PER_HOUR
}

function historicalCacheKey(coinId: string, unixTimestamp: number): string {
  return `${CACHE_PREFIX}:historical:${coinId}:${roundToHour(unixTimestamp)}`
}

function dailyAverageCacheKey(coinId: string, utcDayStartUnixTimestamp: number): string {
  return `${CACHE_PREFIX}:dailyAverage:${coinId}:${roundToHour(utcDayStartUnixTimestamp)}`
}

function readCachedPrice(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null
  } catch {
    // localStorage may be unavailable (privacy mode, disabled, quota) or the
    // stored value may be corrupted — treat as a cache miss, non-fatal.
    return null
  }
}

function writeCachedPrice(key: string, price: number): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(price))
  } catch {
    // non-fatal: the price is still returned for this call, just not persisted
  }
}

/**
 * Historical USD price for `coinId` at `unixTimestamp`, served from the
 * permanent cache when present; otherwise fetched via
 * `defillama.ts#getHistoricalPrice` and, if a price was found, stored in
 * the cache keyed by `(coinId, unixTimestamp rounded to hour)` before being
 * returned. A cache hit never re-fetches.
 */
export async function getCachedHistoricalPrice(
  coinId: string,
  unixTimestamp: number,
): Promise<number | null> {
  const key = historicalCacheKey(coinId, unixTimestamp)
  const cached = readCachedPrice(key)
  if (cached !== null) {
    return cached
  }

  const price = await getHistoricalPrice(coinId, unixTimestamp)
  if (price !== null) {
    writeCachedPrice(key, price)
  }
  return price
}

/**
 * Daily-average USD price for `coinId` over the UTC day starting at
 * `utcDayStartUnixTimestamp`, served from the permanent cache when
 * present; otherwise fetched via `defillama.ts#getDailyAveragePrice` and,
 * if an average was found, stored in the cache before being returned. A
 * cache hit never re-fetches.
 */
export async function getCachedDailyAveragePrice(
  coinId: string,
  utcDayStartUnixTimestamp: number,
): Promise<number | null> {
  const key = dailyAverageCacheKey(coinId, utcDayStartUnixTimestamp)
  const cached = readCachedPrice(key)
  if (cached !== null) {
    return cached
  }

  const price = await getDailyAveragePrice(coinId, utcDayStartUnixTimestamp)
  if (price !== null) {
    writeCachedPrice(key, price)
  }
  return price
}
