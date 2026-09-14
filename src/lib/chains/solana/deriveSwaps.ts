// Solana pre/post balance diffing -> swap classification — implemented in Phase 3, per ARCHITECTURE.md §3.1/§3.4.
//
// Given a parsed transaction (§3.1's `getParsedTransaction` shape) and the
// wallet address being tracked, derives per-mint balance deltas for that
// wallet's own owned accounts, then classifies the transaction as a genuine
// two-sided swap vs. a one-sided transfer per the §3.4 rule: a plain
// incoming transfer with no matching outgoing leg (airdrop, gift, direct
// receive) must be excluded from the Activity feed, even though it still
// correctly contributes to the balances total via the separate balances
// path.

import type { ParsedTransactionResult } from './solanaRpcClient'

/**
 * Sentinel "mint" used for the native SOL leg of a transaction, since native
 * SOL has no mint address of its own (distinct from wrapped SOL, whose mint
 * is a real address, `So111...112`).
 */
export const NATIVE_SOL_MINT = 'native:SOL'

/** Ignore deltas smaller than this to absorb floating-point noise from
 * `uiAmount` diffing — not a real balance change. */
const DUST_EPSILON = 1e-9

export interface TokenDelta {
  mint: string
  /** Signed change in ui-amount (human units, not raw base units). */
  delta: number
}

export interface SwapDerivation {
  /** Non-zero balance deltas across all mints (incl. native SOL) touching
   * the tracked wallet's own owned accounts in this transaction. */
  deltas: TokenDelta[]
  /** True when this transaction has at least one negative-delta mint and
   * one positive-delta mint for the tracked wallet — a genuine swap/trade. */
  isSwap: boolean
  /** True when the tx must be excluded from the Activity view per §3.4 (a
   * one-sided transfer with no matching opposite leg in the same tx). */
  excludeFromActivity: boolean
}

/**
 * Derives this wallet's own token balance deltas (SPL/Token-2022 + native
 * SOL) for a single parsed transaction, and classifies it per §3.4.
 */
export function deriveSwap(
  tx: ParsedTransactionResult,
  walletAddress: string,
): SwapDerivation {
  if (!tx.meta) {
    // No meta (e.g. simulated/unavailable) — nothing to diff.
    return { deltas: [], isSwap: false, excludeFromActivity: true }
  }

  const deltaByMint = new Map<string, number>()
  accumulateTokenDeltas(tx, walletAddress, deltaByMint)
  accumulateNativeSolDelta(tx, walletAddress, deltaByMint)

  const deltas: TokenDelta[] = [...deltaByMint.entries()]
    .filter(([, delta]) => Math.abs(delta) > DUST_EPSILON)
    .map(([mint, delta]) => ({ mint, delta }))

  const hasNegativeLeg = deltas.some((d) => d.delta < 0)
  const hasPositiveLeg = deltas.some((d) => d.delta > 0)
  // A swap needs at least one outgoing and one incoming leg for the wallet
  // in the same transaction; this also correctly handles multi-hop swaps
  // (3+ non-zero deltas) as long as both directions are represented.
  const isSwap = hasNegativeLeg && hasPositiveLeg

  return { deltas, isSwap, excludeFromActivity: !isSwap }
}

/** Diffs `preTokenBalances`/`postTokenBalances` for accounts owned by
 * `walletAddress`, keyed by the parsed `accountIndex`, and accumulates the
 * per-mint ui-amount delta into `deltaByMint`. */
function accumulateTokenDeltas(
  tx: ParsedTransactionResult,
  walletAddress: string,
  deltaByMint: Map<string, number>,
): void {
  const meta = tx.meta
  if (!meta) return

  const preByIndex = new Map(
    (meta.preTokenBalances ?? [])
      .filter((b) => b.owner === walletAddress)
      .map((b) => [b.accountIndex, b] as const),
  )
  const postByIndex = new Map(
    (meta.postTokenBalances ?? [])
      .filter((b) => b.owner === walletAddress)
      .map((b) => [b.accountIndex, b] as const),
  )

  const accountIndices = new Set<number>([
    ...preByIndex.keys(),
    ...postByIndex.keys(),
  ])

  for (const accountIndex of accountIndices) {
    const preEntry = preByIndex.get(accountIndex)
    const postEntry = postByIndex.get(accountIndex)
    const mint = postEntry?.mint ?? preEntry?.mint
    if (!mint) continue

    const preAmount = preEntry?.uiTokenAmount.uiAmount ?? 0
    const postAmount = postEntry?.uiTokenAmount.uiAmount ?? 0
    const delta = postAmount - preAmount

    deltaByMint.set(mint, (deltaByMint.get(mint) ?? 0) + delta)
  }
}

/** Diffs `preBalances`/`postBalances` (lamports, parallel to
 * `transaction.message.accountKeys`) for the account matching
 * `walletAddress`, backing out the network fee if this wallet paid it (the
 * first account key is always the fee payer in Solana's transaction model),
 * and accumulates the native SOL delta (in SOL) into `deltaByMint`. */
function accumulateNativeSolDelta(
  tx: ParsedTransactionResult,
  walletAddress: string,
  deltaByMint: Map<string, number>,
): void {
  const meta = tx.meta
  if (!meta) return

  const accountKeys = tx.transaction.message.accountKeys
  const walletIndex = accountKeys.findIndex(
    (key) => key.pubkey === walletAddress,
  )
  if (walletIndex === -1) return

  const preLamports = meta.preBalances[walletIndex]
  const postLamports = meta.postBalances[walletIndex]
  if (preLamports === undefined || postLamports === undefined) return

  const isFeePayer = walletIndex === 0
  const lamportDelta = postLamports - preLamports + (isFeePayer ? meta.fee : 0)
  const solDelta = lamportDelta / 1_000_000_000

  deltaByMint.set(
    NATIVE_SOL_MINT,
    (deltaByMint.get(NATIVE_SOL_MINT) ?? 0) + solDelta,
  )
}
