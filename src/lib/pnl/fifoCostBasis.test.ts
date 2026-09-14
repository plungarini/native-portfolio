import { describe, expect, it } from 'vitest'
import { computeFifoRealizedPnl, type TradeLeg } from './fifoCostBasis'

describe('computeFifoRealizedPnl', () => {
  it('buy then sell at a profit: realizedPnlUsd = sell value - buy cost basis', () => {
    // Buy 10 tokens @ $2 -> cost basis $20.
    // Sell 10 tokens @ $3 -> value $30.
    // Hand-computed: realizedPnlUsd = 30 - 20 = 10.
    const legs: TradeLeg[] = [
      { timestamp: 1_000, type: 'buy', amountToken: 10, priceUsdAtTrade: 2 },
      { timestamp: 2_000, type: 'sell', amountToken: 10, priceUsdAtTrade: 3 },
    ]

    expect(computeFifoRealizedPnl(legs)).toEqual([
      { timestamp: 2_000, realizedPnlUsd: 10 },
    ])
  })

  it('buy then sell at a loss: realizedPnlUsd is negative', () => {
    // Buy 5 tokens @ $10 -> cost basis $50.
    // Sell 5 tokens @ $6 -> value $30.
    // Hand-computed: realizedPnlUsd = 30 - 50 = -20.
    const legs: TradeLeg[] = [
      { timestamp: 1_000, type: 'buy', amountToken: 5, priceUsdAtTrade: 10 },
      { timestamp: 2_000, type: 'sell', amountToken: 5, priceUsdAtTrade: 6 },
    ]

    expect(computeFifoRealizedPnl(legs)).toEqual([
      { timestamp: 2_000, realizedPnlUsd: -20 },
    ])
  })

  it('multi-lot FIFO: a partial sell consumes the oldest lot first, then spills into the next lot', () => {
    // Lot 1: buy 10 tokens @ $1 -> cost basis $10.
    // Lot 2: buy 10 tokens @ $2 -> cost basis $20.
    // Sell 15 tokens @ $3 -> value $45.
    // FIFO match: fully consumes lot 1 (10 @ $1 = $10 cost), then 5 of the
    // 10 tokens in lot 2 (5 @ $2 = $10 cost) -> total cost basis = $20.
    // Hand-computed: realizedPnlUsd = 45 - 20 = 25.
    // Lot 2 has 5 tokens @ $2 remaining open after this sell.
    //
    // Second sell 5 tokens @ $4 -> value $20, consumes the remaining 5
    // tokens of lot 2 (5 @ $2 = $10 cost).
    // Hand-computed: realizedPnlUsd = 20 - 10 = 10.
    const legs: TradeLeg[] = [
      { timestamp: 1_000, type: 'buy', amountToken: 10, priceUsdAtTrade: 1 },
      { timestamp: 2_000, type: 'buy', amountToken: 10, priceUsdAtTrade: 2 },
      { timestamp: 3_000, type: 'sell', amountToken: 15, priceUsdAtTrade: 3 },
      { timestamp: 4_000, type: 'sell', amountToken: 5, priceUsdAtTrade: 4 },
    ]

    expect(computeFifoRealizedPnl(legs)).toEqual([
      { timestamp: 3_000, realizedPnlUsd: 25 },
      { timestamp: 4_000, realizedPnlUsd: 10 },
    ])
  })

  it('a sell larger than all open lots treats the unmatched excess as zero-cost-basis', () => {
    // Buy 5 tokens @ $2 -> cost basis $10.
    // Sell 8 tokens @ $3 -> value $24.
    // Only 5 tokens have a matching lot (cost $10); the remaining 3 tokens
    // have no open lot, so they contribute $0 cost basis.
    // Hand-computed: realizedPnlUsd = 24 - 10 = 14.
    const legs: TradeLeg[] = [
      { timestamp: 1_000, type: 'buy', amountToken: 5, priceUsdAtTrade: 2 },
      { timestamp: 2_000, type: 'sell', amountToken: 8, priceUsdAtTrade: 3 },
    ]

    expect(computeFifoRealizedPnl(legs)).toEqual([
      { timestamp: 2_000, realizedPnlUsd: 14 },
    ])
  })
})
