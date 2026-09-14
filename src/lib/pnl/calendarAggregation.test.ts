import { describe, expect, it } from 'vitest'
import { aggregateDailyPnl, type AvgPriceForDay } from './calendarAggregation'
import type { RealizedPnlEntry } from './fifoCostBasis'

/** Unix seconds for a UTC instant, for building unambiguous test fixtures. */
function utc(year: number, month: number, day: number, hour = 0): number {
  return Date.UTC(year, month - 1, day, hour) / 1000
}

describe('aggregateDailyPnl', () => {
  it("sums per UTC day and converts USD to main-currency via that day's fixed average price", async () => {
    // Day 1 (2024-01-01 UTC): two trades, +10 and -4 -> dailyPnlUsd = 6.
    // Day 2 (2024-01-02 UTC): two trades, +25 and +25 -> dailyPnlUsd = 50.
    const entries: RealizedPnlEntry[] = [
      { timestamp: utc(2024, 1, 1, 10), realizedPnlUsd: 10 },
      { timestamp: utc(2024, 1, 1, 20), realizedPnlUsd: -4 },
      { timestamp: utc(2024, 1, 2, 1), realizedPnlUsd: 25 },
      { timestamp: utc(2024, 1, 2, 23), realizedPnlUsd: 25 },
    ]

    // Fixed daily-average-price fixture: day 1 avg = $150, day 2 avg = $200.
    const dailyAverageUsdByDayStart = new Map<number, number>([
      [utc(2024, 1, 1), 150],
      [utc(2024, 1, 2), 200],
    ])
    const avgPriceForDay: AvgPriceForDay = async (utcDayStartUnixTimestamp) =>
      dailyAverageUsdByDayStart.get(utcDayStartUnixTimestamp) ?? null

    const result = await aggregateDailyPnl(entries, avgPriceForDay)

    // Hand-computed:
    //   day 1: pnlUsd = 10 + -4 = 6;  pnlMainCurrency = 6 / 150   = 0.04
    //   day 2: pnlUsd = 25 + 25 = 50; pnlMainCurrency = 50 / 200  = 0.25
    expect(result.size).toBe(2)
    expect(result.get('2024-01-01')).toEqual({
      pnlUsd: 6,
      pnlMainCurrency: 0.04,
      avgUsdPrice: 150,
    })
    expect(result.get('2024-01-02')).toEqual({
      pnlUsd: 50,
      pnlMainCurrency: 0.25,
      avgUsdPrice: 200,
    })
  })

  it('keeps trades either side of the UTC midnight boundary in separate days', async () => {
    const entries: RealizedPnlEntry[] = [
      // 2024-03-04 23:59:59 UTC -> day 1.
      { timestamp: Date.UTC(2024, 2, 4, 23, 59, 59) / 1000, realizedPnlUsd: 1 },
      // 2024-03-05 00:00:00 UTC -> day 2.
      { timestamp: Date.UTC(2024, 2, 5, 0, 0, 0) / 1000, realizedPnlUsd: 2 },
    ]
    const avgPriceForDay: AvgPriceForDay = async () => 100

    const result = await aggregateDailyPnl(entries, avgPriceForDay)

    expect(result.size).toBe(2)
    expect(result.get('2024-03-04')?.pnlUsd).toBe(1)
    expect(result.get('2024-03-05')?.pnlUsd).toBe(2)
  })

  it('reports pnlMainCurrency and avgUsdPrice as null when the historical average price is unavailable', async () => {
    const entries: RealizedPnlEntry[] = [
      { timestamp: utc(2024, 1, 1, 10), realizedPnlUsd: 10 },
    ]
    const avgPriceForDay: AvgPriceForDay = async () => null

    const result = await aggregateDailyPnl(entries, avgPriceForDay)

    expect(result.get('2024-01-01')).toEqual({
      pnlUsd: 10,
      pnlMainCurrency: null,
      avgUsdPrice: null,
    })
  })
})
