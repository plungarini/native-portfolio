// Per-token realized PnL, derived from the activity feed via FIFO cost-basis
// lot matching (§5.3). Feeds the holdings table's PnL column.
//
// Only *realized* PnL is reported: a token is included only once it has at
// least one sell leg with a known historical price. Tokens that were only
// ever bought (or whose prices never resolved) are omitted entirely, so the
// table renders an em dash rather than implying a zero result.
//
// The percentage is derived from the identity behind §5.3's formula:
//   realizedPnl = proceeds - costBasis   =>   costBasis = proceeds - realizedPnl
// so no extra bookkeeping is needed beyond each sell leg's own proceeds.

import { useMemo } from 'react'
import { useActivity } from './useActivity'
import { computeFifoRealizedPnl } from '../lib/pnl/fifoCostBasis'
import type { TradeLeg } from '../lib/pnl/fifoCostBasis'
import type { ChainId } from '../types/chain'

export interface TokenPnl {
  usd: number
  percent: number
}

export interface UsePerTokenPnlResult {
  /** Keyed by `${chain}:${tokenId}`, matching `Holding.key`. */
  pnlByKey: Record<string, TokenPnl>
  isLoading: boolean
  isStale: boolean
}

interface TokenLegs {
  legs: TradeLeg[]
  /** USD proceeds of every priced sell leg, for the cost-basis derivation. */
  sellProceedsUsd: number
}

export function usePerTokenPnl(): UsePerTokenPnlResult {
  const { rows, isLoading, isStale } = useActivity()

  const pnlByKey = useMemo(() => {
    const byToken = new Map<string, TokenLegs>()

    for (const row of rows) {
      for (const leg of row.legs) {
        if (leg.priceUsdAtTx === null || !Number.isFinite(leg.amount) || leg.amount <= 0) {
          continue
        }
        const key = `${leg.chain as ChainId}:${leg.tokenId}`
        let entry = byToken.get(key)
        if (!entry) {
          entry = { legs: [], sellProceedsUsd: 0 }
          byToken.set(key, entry)
        }
        const isBuy = leg.direction === 'in'
        entry.legs.push({
          timestamp: row.timestamp,
          type: isBuy ? 'buy' : 'sell',
          amountToken: leg.amount,
          priceUsdAtTrade: leg.priceUsdAtTx,
        })
        if (!isBuy) {
          entry.sellProceedsUsd += leg.amount * leg.priceUsdAtTx
        }
      }
    }

    const result: Record<string, TokenPnl> = {}
    for (const [key, { legs, sellProceedsUsd }] of byToken) {
      const chronological = [...legs].sort((a, b) => a.timestamp - b.timestamp)
      const realized = computeFifoRealizedPnl(chronological)
      if (realized.length === 0) continue

      const usd = realized.reduce((sum, entry) => sum + entry.realizedPnlUsd, 0)
      const costBasisUsd = sellProceedsUsd - usd
      result[key] = {
        usd,
        percent: costBasisUsd > 0 ? (usd / costBasisUsd) * 100 : 0,
      }
    }
    return result
  }, [rows])

  return { pnlByKey, isLoading, isStale }
}
