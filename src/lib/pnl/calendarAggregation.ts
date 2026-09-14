// Per-day PnL calendar aggregation — implemented in Phase 3/5, per ARCHITECTURE.md §5.2.
//
// Groups realized-PnL entries (from fifoCostBasis.ts) by UTC calendar day,
// sums each day's USD PnL, then converts to main-currency units via that
// day's historical average main-currency USD price:
//   dailyPnlUsd(D)          = Σ realizedPnlUsd(trade) for every trade on day D
//   mainCurrencyAvgUsd(D)   = average of the 24 hourly USD prices of mainCurrency on day D
//   dailyPnlMainCurrency(D) = dailyPnlUsd(D) / mainCurrencyAvgUsd(D)
// Never recomputed with a day-level or current price for the USD side —
// each trade's `realizedPnlUsd` already used its own historical price.

import type { RealizedPnlEntry } from './fifoCostBasis'

const SECONDS_PER_DAY = 86400

/** One UTC calendar day's aggregated PnL, per §5.2. */
export interface DailyPnl {
  /** `dailyPnlUsd(D)` — sum of that day's realized PnL, in USD. */
  pnlUsd: number
  /**
   * `dailyPnlMainCurrency(D)`. `null` when `avgUsdPrice` is unavailable
   * (per §5.3's hard rule: never silently fall back to a different price),
   * so the caller can render "price unavailable" instead of a number.
   */
  pnlMainCurrency: number | null
  /** `mainCurrencyAvgUsd(D)`, or `null` if no historical average was found for the day. */
  avgUsdPrice: number | null
}

/**
 * Resolves the historical average USD price of the main currency for the
 * UTC day starting at `utcDayStartUnixTimestamp` (e.g.
 * `historicalPriceCache.ts#getCachedDailyAveragePrice`), or `null` if
 * unavailable for that day.
 */
export type AvgPriceForDay = (
  utcDayStartUnixTimestamp: number,
) => Promise<number | null>

/** Rounds a unix timestamp down to the start (00:00:00 UTC) of its calendar day. */
function utcDayStart(unixTimestamp: number): number {
  return Math.floor(unixTimestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY
}

/** Formats a UTC day-start timestamp as its `YYYY-MM-DD` calendar-date key. */
function utcDayKey(utcDayStartUnixTimestamp: number): string {
  return new Date(utcDayStartUnixTimestamp * 1000).toISOString().slice(0, 10)
}

/**
 * Aggregates `entries` (realized PnL per trade, in USD) into one `DailyPnl`
 * per UTC calendar day that had at least one trade, keyed by that day's
 * `YYYY-MM-DD` date string, per §5.2. `avgPriceForDay` supplies each day's
 * historical average main-currency USD price used for the USD→main-currency
 * conversion.
 */
export async function aggregateDailyPnl(
  entries: RealizedPnlEntry[],
  avgPriceForDay: AvgPriceForDay,
): Promise<Map<string, DailyPnl>> {
  const usdByDayStart = new Map<number, number>()

  for (const entry of entries) {
    const dayStart = utcDayStart(entry.timestamp)
    usdByDayStart.set(
      dayStart,
      (usdByDayStart.get(dayStart) ?? 0) + entry.realizedPnlUsd,
    )
  }

  const result = new Map<string, DailyPnl>()

  for (const [dayStart, pnlUsd] of usdByDayStart) {
    const avgUsdPrice = await avgPriceForDay(dayStart)
    const pnlMainCurrency =
      avgUsdPrice === null || avgUsdPrice === 0 ? null : pnlUsd / avgUsdPrice
    result.set(utcDayKey(dayStart), { pnlUsd, pnlMainCurrency, avgUsdPrice })
  }

  return result
}
