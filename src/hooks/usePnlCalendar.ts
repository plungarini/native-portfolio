// PnL calendar data hook (react-query) — implemented in Phase 5, per ARCHITECTURE.md §5.2/§7.
//
// Feeds `useActivity`'s classified swap rows through `fifoCostBasis.ts`
// (FIFO cost-basis lot matching, per token) then `calendarAggregation.ts`
// (grouping realized PnL by UTC calendar day and converting to
// main-currency units via that day's historical average price), per §5.2:
//
//   dailyPnlUsd(D)          = Σ realizedPnlUsd(trade) for every trade on day D
//   mainCurrencyAvgUsd(D)   = average of the 24 hourly USD prices of mainCurrency on day D
//   dailyPnlMainCurrency(D) = dailyPnlUsd(D) / mainCurrencyAvgUsd(D)
//
// A leg with no resolvable historical price (`priceUsdAtTx: null`, per
// §5.3's hard "never substitute a price" rule) is excluded from cost-basis
// matching entirely, rather than silently treated as zero-cost — this can
// only under-count PnL for obscure tokens with no price history, never
// silently misstate it.

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useActivity, type ActivityRow } from './useActivity'
import {
  computeFifoRealizedPnl,
  type RealizedPnlEntry,
  type TradeLeg,
} from '../lib/pnl/fifoCostBasis'
import {
  aggregateDailyPnl,
  type DailyPnl,
} from '../lib/pnl/calendarAggregation'
import { getCachedDailyAveragePrice } from '../lib/prices/historicalPriceCache'
import { FIXED_UNIT_CURRENCIES, getCurrencyConfig } from '../config/currencies'

export interface PnlCalendarDay extends DailyPnl {
  /** UTC calendar day, `YYYY-MM-DD`. */
  date: string
}

export interface UsePnlCalendarResult {
  days: PnlCalendarDay[]
  mainCurrency: string
  isLoading: boolean
  isFetching: boolean
  /** True when the underlying activity feed is stale/errored, or a daily
   * average-price lookup failed this round, per §2's fallback-path
   * description. */
  isStale: boolean
  error: string | null
}

interface PnlQueryData {
  days: PnlCalendarDay[]
  hadErrors: boolean
  errorMessage: string | null
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Groups every priced leg across all activity rows into chronological
 * buy/sell `TradeLeg` lists, keyed per distinct token (`chain:tokenId`), for
 * `computeFifoRealizedPnl` per §5.3. Legs with no resolvable historical
 * price are dropped (see module doc). */
function buildTradeLegsByToken(rows: ActivityRow[]): Map<string, TradeLeg[]> {
  const byToken = new Map<string, TradeLeg[]>()

  for (const row of rows) {
    for (const leg of row.legs) {
      if (leg.priceUsdAtTx === null) continue

      const key = `${leg.chain}:${leg.tokenId}`
      const legs = byToken.get(key) ?? []
      legs.push({
        timestamp: row.timestamp,
        type: leg.direction === 'out' ? 'sell' : 'buy',
        amountToken: leg.amount,
        priceUsdAtTrade: leg.priceUsdAtTx,
      })
      byToken.set(key, legs)
    }
  }

  for (const legs of byToken.values()) {
    legs.sort((a, b) => a.timestamp - b.timestamp)
  }

  return byToken
}

async function fetchPnlCalendar(
  rows: ActivityRow[],
  mainCurrency: string,
): Promise<PnlQueryData> {
  const errors: string[] = []
  const byToken = buildTradeLegsByToken(rows)

  const realizedEntries: RealizedPnlEntry[] = Array.from(
    byToken.values(),
  ).flatMap((legs) => computeFifoRealizedPnl(legs))

  const currencyConfig = getCurrencyConfig(mainCurrency)
  const mainCurrencyIsFixedUnit = FIXED_UNIT_CURRENCIES.has(
    mainCurrency.toUpperCase(),
  )
  const mainCurrencyCoinId = mainCurrencyIsFixedUnit
    ? null
    : (currencyConfig?.coinId ?? null)

  const avgPriceForDay = async (dayStart: number): Promise<number | null> => {
    if (mainCurrencyIsFixedUnit) return 1
    if (!mainCurrencyCoinId) return null
    try {
      return await getCachedDailyAveragePrice(mainCurrencyCoinId, dayStart)
    } catch (err) {
      errors.push(describeError(err))
      return null
    }
  }

  const dayMap = await aggregateDailyPnl(realizedEntries, avgPriceForDay)
  const days: PnlCalendarDay[] = Array.from(dayMap.entries())
    .map(([date, day]) => ({ date, ...day }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  return { days, hadErrors: errors.length > 0, errorMessage: errors[0] ?? null }
}

/** Stable fingerprint of the activity rows feeding the calendar, so the
 * derived query only re-runs when the actual tx set/prices change. */
function rowsFingerprint(rows: ActivityRow[]): string[] {
  return rows.map((r) => `${r.chain}:${r.txHash}:${r.timestamp}`)
}

/**
 * Per-UTC-day realized PnL across every wallet's activity, in both USD and
 * `mainCurrency` units, per §5.2.
 */
export function usePnlCalendar(): UsePnlCalendarResult {
  const {
    rows,
    mainCurrency,
    isLoading: activityIsLoading,
    isStale: activityIsStale,
    error: activityError,
  } = useActivity()

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['pnlCalendar', rowsFingerprint(rows), mainCurrency],
    queryFn: () => fetchPnlCalendar(rows, mainCurrency),
    placeholderData: keepPreviousData,
    retry: 1,
  })

  return {
    days: data?.days ?? [],
    mainCurrency,
    isLoading: activityIsLoading || isLoading,
    isFetching,
    isStale: activityIsStale || Boolean(data?.hadErrors) || isError,
    error: activityError ?? data?.errorMessage ?? null,
  }
}
