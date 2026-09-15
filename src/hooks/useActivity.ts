// Activity/trade history data hook (react-query) — implemented in Phase 5,
// per ARCHITECTURE.md §5.3/§7; extended for full-history sync + one-sided
// transfers per the Sept 2026 UX pass.
//
// For the current `wallets[]` (from `useWallets`), fetches transaction
// history via each wallet's chain client, runs it through that chain's
// `deriveSwaps` module to classify each transaction's deltas, then splits
// the result into two feeds: two-sided swaps (`rows`, per §3.4's Activity
// view) and one-sided transfers (`transfers` — deposits/withdrawals, which
// still count toward the spot balance total via `useHoldings` but were
// previously discarded entirely rather than surfaced anywhere).
//
// Solana history is backed by a permanent, incrementally-updated local
// cache (`activityHistoryCache.ts`): the first load for a wallet pages
// backward through its full signature history (capped at
// `SOLANA_ACTIVITY_HARD_CAP` as a safety valve against a pathologically
// active wallet locking up the browser/RPC — `isPartial` is set true if
// that cap is hit, so the UI can say so rather than silently
// under-representing history); every later load only fetches signatures
// newer than the cache's high-water mark. This is what makes full-history
// FIFO cost-basis (§5.3, `fifoCostBasis.ts`) both accurate and fast after
// the first visit.
//
// Each kept transaction's legs are priced at that transaction's own
// historical timestamp (never the current/live price — a hard rule, §5.3)
// via `historicalPriceCache.ts`, per:
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
  getParsedTransactionsBatch,
  getSignatures,
} from '../lib/chains/solana/solanaRpcClient'
import { NATIVE_SOL_MINT, deriveSwap } from '../lib/chains/solana/deriveSwaps'
import type { TokenDelta } from '../lib/chains/solana/deriveSwaps'
import {
  readActivityCache,
  writeActivityCache,
} from '../lib/chains/solana/activityHistoryCache'
import type { CachedTxDeltas } from '../lib/chains/solana/activityHistoryCache'
import {
  blockNumberToHex,
  getTransferLogs,
  hexToBigInt,
  rpcRequest,
} from '../lib/chains/bsc/bscRpcClient'
import { deriveActivity, isActivityFeedEligible } from '../lib/chains/bsc/deriveSwaps'
import { bscKnownTokens } from '../config/chains'
import { getCachedHistoricalPrice } from '../lib/prices/historicalPriceCache'
import { getTokenMetadata } from '../lib/tokens/jupiterTokenMetadata'
import { FIXED_UNIT_CURRENCIES, getCurrencyConfig } from '../config/currencies'
import type { WalletEntry } from '../types/state'
import type { ChainId } from '../types/chain'

/** Native BNB has no ERC-20 Transfer log of its own, so it never appears as
 * a leg here — this module only ever sees curated `bscKnownTokens`. */

/** Wrapped SOL's mint — the id token-metadata search resolves native SOL
 * under, mirroring `useHoldings.ts`'s own mapping. */
const WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112'

/** Signatures requested per page while paging backward through a wallet's
 * history (the RPC's own practical page-size ceiling). */
const SOLANA_SIGNATURE_PAGE_SIZE = 1000

/** Hard ceiling on how many new signatures a single cold-cache backfill will
 * walk before giving up and marking the result `isPartial` — protects the
 * browser and the free public RPC from an unbounded scan on a
 * pathologically active wallet. Comfortably above any normal wallet's
 * lifetime transaction count. */
const SOLANA_ACTIVITY_HARD_CAP = 2000

/** How many blocks back to scan for BSC `Transfer` logs per wallet, per call
 * (public nodes cap a single `eth_getLogs` window at ~5,000 blocks anyway —
 * `getTransferLogs` paginates within this range, per §3.2). BSC has no
 * signature-cursor equivalent to page backward from indefinitely on a free
 * public RPC, so unlike Solana this stays a bounded recent window rather
 * than true full history — `isPartial` is always true for BSC wallets to
 * say so honestly rather than imply completeness it can't have. */
const BSC_ACTIVITY_LOOKBACK_BLOCKS = 20_000

export interface ActivityLegRow {
  direction: 'in' | 'out'
  chain: ChainId
  tokenId: string
  amount: number
  symbol: string
  name: string
  iconUrl: string | null
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

export interface TransferRow extends ActivityRow {
  direction: 'deposit' | 'withdrawal'
}

export interface UseActivityResult {
  rows: ActivityRow[]
  transfers: TransferRow[]
  mainCurrency: string
  isLoading: boolean
  isFetching: boolean
  /** True when at least one wallet/leg lookup failed this round, per §2. */
  isStale: boolean
  /** True when a wallet's history is known to be incomplete — either a
   * Solana wallet whose full-history backfill hit the safety cap, or any
   * BSC wallet (whose activity is always a bounded recent window). */
  isPartial: boolean
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
  isSwap: boolean
  legs: RawLeg[]
}

interface ActivityQueryData {
  rows: ActivityRow[]
  transfers: TransferRow[]
  hadErrors: boolean
  isPartial: boolean
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

function activityFromDeltas(
  walletAddress: string,
  entry: CachedTxDeltas,
): RawActivity | null {
  const legs: RawLeg[] = entry.deltas.map((d: TokenDelta) => ({
    direction: d.delta < 0 ? 'out' : 'in',
    tokenId: d.mint,
    amount: Math.abs(d.delta),
  }))
  if (legs.length === 0) return null

  const hasNegativeLeg = entry.deltas.some((d) => d.delta < 0)
  const hasPositiveLeg = entry.deltas.some((d) => d.delta > 0)

  return {
    chain: 'solana',
    walletAddress,
    txHash: entry.signature,
    timestamp: entry.blockTime,
    isSwap: hasNegativeLeg && hasPositiveLeg,
    legs,
  }
}

/**
 * Syncs one Solana wallet's full transaction history against the permanent
 * local cache: pages backward with `getSignatures`'s `before` cursor,
 * stopping as soon as it reaches the cache's high-water-mark signature (the
 * common, cheap case after the first visit), or once it runs out of
 * history, or at `SOLANA_ACTIVITY_HARD_CAP` new signatures (`isPartial`).
 * Batch-fetches + derives only the genuinely new signatures, merges with
 * the cached deltas, writes the cache back, and returns every known
 * transaction's classification for this wallet.
 */
async function fetchSolanaActivity(
  wallet: WalletEntry,
): Promise<{ activities: RawActivity[]; isPartial: boolean }> {
  const cache = await readActivityCache(wallet.address)
  const cachedNewest = cache?.newestSignature ?? null

  const newSignatures: { signature: string; blockTime: number | null }[] = []
  let before: string | undefined
  let isPartial = false

  while (true) {
    const page = await getSignatures(
      wallet.address,
      SOLANA_SIGNATURE_PAGE_SIZE,
      before,
    )
    if (page.length === 0) break

    let reachedCache = false
    for (const sig of page) {
      if (cachedNewest !== null && sig.signature === cachedNewest) {
        reachedCache = true
        break
      }
      newSignatures.push({ signature: sig.signature, blockTime: sig.blockTime })
    }
    if (reachedCache) break

    if (newSignatures.length >= SOLANA_ACTIVITY_HARD_CAP) {
      isPartial = true
      break
    }
    if (page.length < SOLANA_SIGNATURE_PAGE_SIZE) break // wallet genesis reached
    before = page[page.length - 1].signature
  }

  const parsedTxs = await getParsedTransactionsBatch(
    newSignatures.map((s) => s.signature),
  )

  const newDeltas: CachedTxDeltas[] = []
  for (let i = 0; i < newSignatures.length; i++) {
    const tx = parsedTxs[i]
    if (!tx) continue
    const derivation = deriveSwap(tx, wallet.address)
    if (derivation.deltas.length === 0) continue
    newDeltas.push({
      signature: newSignatures[i].signature,
      blockTime: tx.blockTime ?? newSignatures[i].blockTime ?? 0,
      deltas: derivation.deltas,
    })
  }

  const mergedBySignature = new Map<string, CachedTxDeltas>()
  for (const entry of cache?.deltas ?? []) mergedBySignature.set(entry.signature, entry)
  for (const entry of newDeltas) mergedBySignature.set(entry.signature, entry)
  const merged = [...mergedBySignature.values()].sort((a, b) => a.blockTime - b.blockTime)

  const newestSignature = newSignatures[0]?.signature ?? cachedNewest
  if (newestSignature !== null) {
    await writeActivityCache(wallet.address, { newestSignature, deltas: merged })
  }

  const activities = merged
    .map((entry) => activityFromDeltas(wallet.address, entry))
    .filter((a): a is RawActivity => a !== null)

  return { activities, isPartial }
}

/** Fetches + classifies recent BSC activity for one wallet, scanning every
 * curated known token (§3.2 — BSC balances/activity are coverage-limited to
 * this list plus user-added tokens, not exhaustively enumerable). Always a
 * bounded recent window, never full history — see the module-level note on
 * `BSC_ACTIVITY_LOOKBACK_BLOCKS`. */
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

  const activities = deriveActivity(wallet.address, logs)
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
    isSwap: isActivityFeedEligible(activity),
    legs: activity.legs.map((leg) => ({
      direction: leg.direction,
      tokenId: leg.tokenAddress,
      amount: leg.amount,
    })),
  }))
}

function bscTokenMetaFor(tokenId: string): { symbol: string; name: string } {
  const known = bscKnownTokens.find(
    (t) => t.address.toLowerCase() === tokenId.toLowerCase(),
  )
  return known ? { symbol: known.symbol, name: known.name } : { symbol: tokenId, name: tokenId }
}

async function fetchActivity(
  wallets: WalletEntry[],
  mainCurrency: string,
): Promise<ActivityQueryData> {
  if (wallets.length === 0) {
    return { rows: [], transfers: [], hadErrors: false, isPartial: false, errorMessage: null }
  }

  const errors: string[] = []
  let isPartial = false

  const perWallet = await Promise.all(
    wallets.map(async (wallet) => {
      try {
        if (wallet.chain === 'solana') {
          const { activities, isPartial: walletPartial } = await fetchSolanaActivity(wallet)
          if (walletPartial) isPartial = true
          return activities
        }
        isPartial = true // BSC is always a bounded window, per module note
        return await fetchBscActivity(wallet)
      } catch (err) {
        errors.push(describeError(err))
        return []
      }
    }),
  )

  const raw = perWallet.flat().sort((a, b) => b.timestamp - a.timestamp)

  const solanaMints = Array.from(
    new Set(
      raw
        .filter((a) => a.chain === 'solana')
        .flatMap((a) => a.legs.map((l) => l.tokenId))
        .map((mint) => (mint === NATIVE_SOL_MINT ? WRAPPED_SOL_MINT : mint)),
    ),
  )
  let metadataByMint: Record<string, { symbol: string; name: string; iconUrl: string | null }> = {}
  try {
    metadataByMint = await getTokenMetadata(solanaMints)
  } catch (err) {
    errors.push(describeError(err))
  }

  const currencyConfig = getCurrencyConfig(mainCurrency)
  const mainCurrencyIsFixedUnit = FIXED_UNIT_CURRENCIES.has(
    mainCurrency.toUpperCase(),
  )
  const mainCurrencyCoinId = mainCurrencyIsFixedUnit
    ? null
    : (currencyConfig?.coinId ?? null)

  const rows: ActivityRow[] = []
  const transfers: TransferRow[] = []

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

        let symbol: string
        let name: string
        let iconUrl: string | null
        if (activity.chain === 'solana') {
          if (leg.tokenId === NATIVE_SOL_MINT) {
            symbol = 'SOL'
            name = 'Solana'
            iconUrl = null
          } else {
            const meta = metadataByMint[leg.tokenId]
            symbol = meta?.symbol ?? leg.tokenId
            name = meta?.name ?? symbol
            iconUrl = meta?.iconUrl ?? null
          }
        } else {
          const meta = bscTokenMetaFor(leg.tokenId)
          symbol = meta.symbol
          name = meta.name
          iconUrl = null
        }

        return {
          direction: leg.direction,
          chain: activity.chain,
          tokenId: leg.tokenId,
          amount: leg.amount,
          symbol,
          name,
          iconUrl,
          priceUsdAtTx,
          valueUsd,
          valueMainCurrency,
        }
      }),
    )

    const row: ActivityRow = {
      chain: activity.chain,
      walletAddress: activity.walletAddress,
      txHash: activity.txHash,
      timestamp: activity.timestamp,
      legs,
    }

    if (activity.isSwap) {
      rows.push(row)
    } else {
      const direction = legs.some((l) => l.direction === 'in') ? 'deposit' : 'withdrawal'
      transfers.push({ ...row, direction })
    }
  }

  return { rows, transfers, hadErrors: errors.length > 0, isPartial, errorMessage: errors[0] ?? null }
}

/** Stable per-wallet cache key, order-independent. */
function walletsCacheKey(wallets: WalletEntry[]): string[] {
  return wallets.map((w) => `${w.chain}:${w.address}`).sort()
}

/**
 * Full swap + one-sided-transfer activity across every wallet in
 * `wallets[]`, classified and priced per §5.3/§3.4.
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
    transfers: data?.transfers ?? [],
    mainCurrency,
    isLoading,
    isFetching,
    isStale: Boolean(data?.hadErrors) || isError,
    isPartial: Boolean(data?.isPartial),
    error: data?.errorMessage ?? null,
  }
}
