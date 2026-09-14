// FIFO cost-basis lot matching — implemented in Phase 3/5, per ARCHITECTURE.md §5.3.
//
// Each buy leg opens a lot at that leg's own historical USD price
// (`priceUsdAtTrade`). Each sell leg closes the oldest open lot(s) first
// (a FIFO queue), and its realized PnL is the sell's USD value minus the
// USD cost basis of whichever lot(s) it consumed — per §5.3:
//   realizedPnlUsd(tx) = tx.valueUsd - costBasisUsd(matched lots)
// This is the exact per-trade figure summed per-day in §5.2.

/** One buy or sell leg for a single token, in chronological order. */
export interface TradeLeg {
  /** Unix timestamp (seconds) the leg executed at. */
  timestamp: number
  type: 'buy' | 'sell'
  /** Amount of the token bought or sold, always positive. */
  amountToken: number
  /** That leg's own historical USD price per token, per §5.3's `priceUsdAtT`. */
  priceUsdAtTrade: number
}

/** Realized PnL (USD) for one sell leg, per §5.3. */
export interface RealizedPnlEntry {
  timestamp: number
  realizedPnlUsd: number
}

/** An open FIFO lot: tokens bought at a given price, partially or fully unconsumed. */
interface Lot {
  remainingAmountToken: number
  priceUsdAtTrade: number
}

/**
 * Floating-point amounts can leave a lot with a vanishingly small
 * (but nonzero) `remainingAmountToken` after being fully consumed — treat
 * anything at or below this as fully closed so it doesn't linger in the
 * FIFO queue and get partially matched against a later sell.
 */
const EPSILON_TOKEN_AMOUNT = 1e-9

/**
 * Computes realized PnL (USD) for every sell leg in `legs`, a chronological
 * list of buy/sell legs for a single token, using FIFO cost-basis lot
 * matching per §5.3: each buy opens a lot; each sell consumes the oldest
 * open lot(s) first, and its `realizedPnlUsd` is its USD value minus the
 * USD cost basis of the lot(s) it consumed. Buy legs produce no entry.
 *
 * If a sell's `amountToken` exceeds all currently open lots (more sold than
 * ever bought — e.g. incomplete trade history), the unmatched excess is
 * treated as zero-cost-basis rather than throwing, so the function always
 * returns a result for every sell leg.
 */
export function computeFifoRealizedPnl(legs: TradeLeg[]): RealizedPnlEntry[] {
  const openLots: Lot[] = []
  const realizedEntries: RealizedPnlEntry[] = []

  for (const leg of legs) {
    if (leg.type === 'buy') {
      openLots.push({
        remainingAmountToken: leg.amountToken,
        priceUsdAtTrade: leg.priceUsdAtTrade,
      })
      continue
    }

    let remainingToSell = leg.amountToken
    let costBasisUsd = 0

    while (remainingToSell > EPSILON_TOKEN_AMOUNT && openLots.length > 0) {
      const oldestLot = openLots[0]
      const consumedFromLot = Math.min(
        oldestLot.remainingAmountToken,
        remainingToSell,
      )

      costBasisUsd += consumedFromLot * oldestLot.priceUsdAtTrade
      oldestLot.remainingAmountToken -= consumedFromLot
      remainingToSell -= consumedFromLot

      if (oldestLot.remainingAmountToken <= EPSILON_TOKEN_AMOUNT) {
        openLots.shift()
      }
    }

    const valueUsd = leg.amountToken * leg.priceUsdAtTrade
    realizedEntries.push({
      timestamp: leg.timestamp,
      realizedPnlUsd: valueUsd - costBasisUsd,
    })
  }

  return realizedEntries
}
