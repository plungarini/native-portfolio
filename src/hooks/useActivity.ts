// Activity/trade history data hook (react-query) — implemented in Phase 5, per ARCHITECTURE.md §5.3/§7.
//
// For the current `wallets[]` (from `useWallets`), fetches recent
// transaction history via each wallet's chain client, runs it through that
// chain's `deriveSwaps` module to classify each transaction as a genuine
// two-sided swap vs. a one-sided transfer, and keeps only the swaps —
// one-sided transfers (airdrops/direct receives) are excluded from the
// Activity feed per §3.4, even though they still count toward the spot
// balance total via `useHoldings`.
//
// Each kept transaction's legs are priced at that transaction's own
// historical timestamp (never the current/live price — that's a hard rule,
// §5.3) via `historicalPriceCache.ts`, per:
//
//   priceUsdAtT(token)   = historicalPriceLookup(token, t)
//   tx.valueUsd          = tx.amountToken * priceUsdAtT(tx.token)
//   tx.valueMainCurrency = tx.valueUsd / priceUsdAtT(mainCurrency)   // same t
//
// Never throws on a per-wallet/per-leg failure — whatever resolved is still
// returned, with `isStale`/`error` surfaced per §2's fallback-path
// description.

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useWallets } from './useWallets'
import {
  getParsedTransaction,
  getSignatures,
} from '../lib/chains/solana/solanaRpcClient'
import { NATIVE_SOL_MINT, deriveSwap } from '../lib/chains/solana/deriveSwaps'
import {
  blockNumberToHex,
  getTransferLogs,
  hexToBigInt,
  rpcRequest,
} from '../lib/chains/bsc/bscRpcClient'
import {
  deriveActivity,
  isActivityFeedEligible,
} from '../lib/chains/bsc/deriveSwaps'
import { bscKnownTokens } from '../config/chains'
import { getCachedHistoricalPrice } from '../lib/prices/historicalPriceCache'
import { FIXED_UNIT_CURRENCIES, getCurrencyConfig } from '../config/currencies'
import type { WalletEntry } from '../types/state'
import type { ChainId } from '../types/chain'

/** Most-recent-N signatures fetched per Solana wallet, per call. */
const SOLANA_ACTIVITY_HISTORY_LIMIT = 20

/** How many blocks back to scan for BSC `Transfer` logs per wallet, per call
 * (public nodes cap a single `eth_getLogs` window at ~5,000 blocks anyway —
 * `getTransferLogs` paginates within this range, per §3.2). */
const BSC_ACTIVITY_LOOKBACK_BLOCKS = 5_000

export interface ActivityLegRow {
  direction: 'in' | 'out'
  chain: ChainId
  tokenId: string
  amount: number
  /** `priceUsdAtT(tx.token)`, `null` when no historical price was found. */
  priceUsdAtTx: number | null
  valueUsd: number | null
  valueMainCurrency: number | null
}

export interface ActivityRow {
  chain: ChainId
  walletAddress: string
  txHash: string
  timestamp: number
  legs: ActivityLegRow[]
}

export interface UseActivityResult {
  rows: ActivityRow[]
  mainCurrency: string
  isLoading: boolean
  isFetching: boolean
  /** True when at least one wallet/leg lookup failed this round, per §2. */
  isStale: boolean
  error: string | null
}

interface RawLeg {
  direction: 'in' | 'out'
  tokenId: string
  amount: number
}

interface RawActivity {
  chain: ChainId
  walletAddress: string
  txHash: string
  timestamp: number
  legs: RawLeg[]
}

interface ActivityQueryData {
  rows: ActivityRow[]
  hadErrors: boolean
  errorMessage: string | null
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function coinIdFor(chain: ChainId, tokenId: string): string {
  if (chain === 'solana') {
    return tokenId === NATIVE_SOL_MINT
      ? 'coingecko:solana'
      : `solana:${tokenId}`
  }
  return `bsc:${tokenId}`
}

/** Fetches + classifies recent Solana activity for one wallet. A single
 * transaction that fails to parse is skipped rather than dropping the
 * wallet's whole history; a failure fetching the signature list itself
 * propagates so the caller can mark the round as having had errors. */
async function fetchSolanaActivity(
  wallet: WalletEntry,
): Promise<RawActivity[]> {
  const signatures = await getSignatures(
    wallet.address,
    SOLANA_ACTIVITY_HISTORY_LIMIT,
  )

  const perSignature = await Promise.all(
    signatures.map(async (sig): Promise<RawActivity | null> => {
      try {
        const tx = await getParsedTransaction(sig.signature)
        if (!tx) return null
        const derivation = deriveSwap(tx, wallet.address)
        if (derivation.excludeFromActivity) return null
        return {
          chain: 'solana',
          walletAddress: wallet.address,
          txHash: sig.signature,
          timestamp: tx.blockTime ?? sig.blockTime ?? 0,
          legs: derivation.deltas.map((d) => ({
            direction: d.delta < 0 ? 'out' : 'in',
            tokenId: d.mint,
            amount: Math.abs(d.delta),
          })),
        }
      } catch {
        // One bad/pruned signature shouldn't drop the whole wallet's feed.
        return null
      }
    }),
  )

  return perSignature.filter((a): a is RawActivity => a !== null)
}

/** Fetches + classifies recent BSC activity for one wallet, scanning every
 * curated known token (§3.2 — BSC balances/activity are coverage-limited to
 * this list plus user-added tokens, not exhaustively enumerable). */
async function fetchBscActivity(wallet: WalletEntry): Promise<RawActivity[]> {
  const latestBlockHex = await rpcRequest<string>('eth_blockNumber', [])
  const latestBlock = Number(hexToBigInt(latestBlockHex))
  const fromBlock = Math.max(0, latestBlock - BSC_ACTIVITY_LOOKBACK_BLOCKS)

  const logsPerToken = await Promise.all(
    bscKnownTokens.map((token) =>
      getTransferLogs(
        wallet.address,
        token.address,
        fromBlock,
        latestBlock,
      ).catch(() => []),
    ),
  )
  const logs = logsPerToken.flat()

  const activities = deriveActivity(wallet.address, logs).filter(
    isActivityFeedEligible,
  )
  if (activities.length === 0) return []

  const blockNumbers = Array.from(new Set(activities.map((a) => a.blockNumber)))
  const timestampByBlock = new Map<number, number>()
  await Promise.all(
    blockNumbers.map(async (blockNumber) => {
      try {
        const block = await rpcRequest<{ timestamp: string }>(
          'eth_getBlockByNumber',
          [blockNumberToHex(blockNumber), false],
        )
        timestampByBlock.set(blockNumber, Number(hexToBigInt(block.timestamp)))
      } catch {
        // Leave unset — the transaction still surfaces, just with timestamp 0
        // (and therefore no historical price resolvable for it).
      }
    }),
  )

  return activities.map((activity) => ({
    chain: 'bsc' as const,
    walletAddress: wallet.address,
    txHash: activity.txHash,
    timestamp: timestampByBlock.get(activity.blockNumber) ?? 0,
    legs: activity.legs.map((leg) => ({
      direction: leg.direction,
      tokenId: leg.tokenAddress,
      amount: leg.amount,
    })),
  }))
}

async function fetchActivity(
  wallets: WalletEntry[],
  mainCurrency: string,
): Promise<ActivityQueryData> {
  if (wallets.length === 0) {
    return { rows: [], hadErrors: false, errorMessage: null }
  }

  const errors: string[] = []

  const perWallet = await Promise.all(
    wallets.map(async (wallet) => {
      try {
        return wallet.chain === 'solana'
          ? await fetchSolanaActivity(wallet)
          : await fetchBscActivity(wallet)
      } catch (err) {
        errors.push(describeError(err))
        return []
      }
    }),
  )

  const raw = perWallet.flat().sort((a, b) => b.timestamp - a.timestamp)

  const currencyConfig = getCurrencyConfig(mainCurrency)
  const mainCurrencyIsFixedUnit = FIXED_UNIT_CURRENCIES.has(
    mainCurrency.toUpperCase(),
  )
  const mainCurrencyCoinId = mainCurrencyIsFixedUnit
    ? null
    : (currencyConfig?.coinId ?? null)

  const rows: ActivityRow[] = []

  for (const activity of raw) {
    let mainCurrencyPriceAtT: number | null = mainCurrencyIsFixedUnit ? 1 : null
    if (!mainCurrencyIsFixedUnit && mainCurrencyCoinId) {
      try {
        mainCurrencyPriceAtT = await getCachedHistoricalPrice(
          mainCurrencyCoinId,
          activity.timestamp,
        )
      } catch (err) {
        errors.push(describeError(err))
      }
    }

    const legs: ActivityLegRow[] = await Promise.all(
      activity.legs.map(async (leg): Promise<ActivityLegRow> => {
        const coinId = coinIdFor(activity.chain, leg.tokenId)
        let priceUsdAtTx: number | null = null
        try {
          priceUsdAtTx = await getCachedHistoricalPrice(
            coinId,
            activity.timestamp,
          )
        } catch (err) {
          errors.push(describeError(err))
        }
        const valueUsd =
          priceUsdAtTx !== null ? leg.amount * priceUsdAtTx : null
        const valueMainCurrency =
          valueUsd !== null &&
          mainCurrencyPriceAtT !== null &&
          mainCurrencyPriceAtT !== 0
            ? valueUsd / mainCurrencyPriceAtT
            : null
        return {
          direction: leg.direction,
          chain: activity.chain,
          tokenId: leg.tokenId,
          amount: leg.amount,
          priceUsdAtTx,
          valueUsd,
          valueMainCurrency,
        }
      }),
    )

    rows.push({
      chain: activity.chain,
      walletAddress: activity.walletAddress,
      txHash: activity.txHash,
      timestamp: activity.timestamp,
      legs,
    })
  }

  return { rows, hadErrors: errors.length > 0, errorMessage: errors[0] ?? null }
}

/** Stable per-wallet cache key, order-independent. */
function walletsCacheKey(wallets: WalletEntry[]): string[] {
  return wallets.map((w) => `${w.chain}:${w.address}`).sort()
}

/**
 * Recent swap activity across every wallet in `wallets[]`, classified and
 * priced per §5.3/§3.4.
 */
export function useActivity(): UseActivityResult {
  const { wallets, mainCurrency } = useWallets()

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['activity', walletsCacheKey(wallets), mainCurrency],
    queryFn: () => fetchActivity(wallets, mainCurrency),
    placeholderData: keepPreviousData,
    retry: 1,
  })

  return {
    rows: data?.rows ?? [],
    mainCurrency,
    isLoading,
    isFetching,
    isStale: Boolean(data?.hadErrors) || isError,
    error: data?.errorMessage ?? null,
  }
}
