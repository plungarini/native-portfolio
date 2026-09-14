// BSC Transfer-log diffing -> swap classification — implemented in Phase 3, per ARCHITECTURE.md §3.2/§3.4.
//
// Mirrors the Solana module's classification contract (`solana/deriveSwaps.ts`)
// so both chains produce the same `{ type: 'swap' | 'transfer', legs: [...] }`
// shape for the ActivityTable UI layer: a transaction with both an outgoing
// and an incoming leg touching the tracked wallet is a `swap`; a transaction
// with only an incoming leg (airdrop/direct receive, no matching outgoing
// leg) is a one-sided `transfer`, per the two-sided-transfer rule in §3.4.

import type { TransferLogEntry } from './bscRpcClient'

export type ActivityType = 'swap' | 'transfer'

export interface ActivityLeg {
  direction: 'in' | 'out'
  tokenAddress: string
  /** The other address in this leg's Transfer event. */
  counterparty: string
  amountRaw: bigint
  amount: number
}

export interface DerivedActivity {
  type: ActivityType
  txHash: string
  blockNumber: number
  legs: ActivityLeg[]
}

/**
 * Groups a flat list of Transfer logs (as returned by `getTransferLogs`,
 * potentially spanning many transactions and multiple known token
 * contracts) by transaction hash, then classifies each transaction's set
 * of legs touching `walletAddress` as a two-sided `swap` or a one-sided
 * `transfer`.
 *
 * Only logs where `walletAddress` is one side of the Transfer (`from` or
 * `to`) contribute a leg; a log where the wallet is neither is ignored
 * (defensive — callers are expected to have already filtered to logs
 * touching the wallet, per `getTransferLogs`).
 */
export function deriveActivity(
  walletAddress: string,
  logs: TransferLogEntry[],
): DerivedActivity[] {
  const wallet = walletAddress.toLowerCase()

  const logsByTx = new Map<string, TransferLogEntry[]>()
  for (const log of logs) {
    const existing = logsByTx.get(log.txHash)
    if (existing) {
      existing.push(log)
    } else {
      logsByTx.set(log.txHash, [log])
    }
  }

  const activities: DerivedActivity[] = []
  for (const [txHash, txLogs] of logsByTx) {
    const legs: ActivityLeg[] = []

    for (const log of txLogs) {
      const from = log.from.toLowerCase()
      const to = log.to.toLowerCase()

      if (from === wallet) {
        legs.push({
          direction: 'out',
          tokenAddress: log.tokenAddress,
          counterparty: log.to,
          amountRaw: log.amountRaw,
          amount: log.amount,
        })
      }
      if (to === wallet) {
        legs.push({
          direction: 'in',
          tokenAddress: log.tokenAddress,
          counterparty: log.from,
          amountRaw: log.amountRaw,
          amount: log.amount,
        })
      }
    }

    if (legs.length === 0) continue

    const hasOutgoingLeg = legs.some((leg) => leg.direction === 'out')
    const hasIncomingLeg = legs.some((leg) => leg.direction === 'in')

    activities.push({
      type: hasOutgoingLeg && hasIncomingLeg ? 'swap' : 'transfer',
      txHash,
      blockNumber: txLogs[0].blockNumber,
      legs,
    })
  }

  activities.sort((a, b) => b.blockNumber - a.blockNumber)
  return activities
}

/**
 * The ActivityTable filter from §3.4: only genuine two-sided swaps are
 * shown in the Activity feed. A one-sided incoming transfer (airdrop, gift,
 * direct receive) still correctly contributes to the wallet's spot balance
 * total via the balances path, but is excluded here.
 */
export function isActivityFeedEligible(activity: DerivedActivity): boolean {
  return activity.type === 'swap'
}
