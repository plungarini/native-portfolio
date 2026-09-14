// Aggregated holdings data hook (react-query) — implemented in Phase 5, per ARCHITECTURE.md §5.1/§7.
//
// For the current `wallets[]` (from `useWallets`), fetches spot balances via
// each wallet's chain client (Solana: native SOL + SPL/Token-2022 via
// `solanaRpcClient`; BSC: native BNB + curated BEP-20 list via
// `bscRpcClient`), aggregates same-token amounts across wallets, then prices
// every held token "now" per §5.1:
//
//   usdValue(h)         = h.amountToken * currentUsdPrice(h.token)
//   mainCurrencyValue(h) = usdValue(h) / currentUsdPrice(mainCurrency)
//
// Current pricing prefers Jupiter Price v3 for Solana-side tokens, falling
// back to DefiLlama's `/prices/current` for anything Jupiter doesn't price
// and for all BSC-side tokens (§3.3); if both throw for a token that's on
// the fixed major-token watchlist, the committed price snapshot
// (`snapshotFallback.ts`) is tried last (§2's fallback path). A token with
// no price from any source renders with `currentUsdPrice: null` ("price
// unavailable") rather than a wrong/substituted value.
//
// Never throws on a per-wallet or per-token failure: whatever balances/
// prices did resolve are still returned, with `isStale`/`error` surfaced
// alongside them so the UI can show a "stale" badge instead of crashing,
// per §2's fallback-path description.

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useWallets } from './useWallets'
import {
  getSolBalance,
  getTokenBalances as getSolanaTokenBalances,
} from '../lib/chains/solana/solanaRpcClient'
import { NATIVE_SOL_MINT } from '../lib/chains/solana/deriveSwaps'
import {
  getBnbBalance,
  getTokenBalances as getBscTokenBalances,
} from '../lib/chains/bsc/bscRpcClient'
import { bscKnownTokens } from '../config/chains'
import { getCurrentPricesJupiter } from '../lib/prices/jupiterPriceV3'
import { getCurrentPrice as getDefillamaCurrentPrice } from '../lib/prices/defillama'
import { getSnapshotPrice } from '../lib/prices/snapshotFallback'
import { FIXED_UNIT_CURRENCIES, getCurrencyConfig } from '../config/currencies'
import type { WalletEntry } from '../types/state'
import type { ChainId } from '../types/chain'

/** Sentinel token id for native BNB, mirroring `NATIVE_SOL_MINT`'s role for Solana. */
export const NATIVE_BNB_TOKEN_ID = 'native:BNB'

/** Wrapped SOL's mint — the id Jupiter Price v3 prices native SOL under. */
const WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112'

export interface Holding {
  key: string
  chain: ChainId
  /** Mint address (Solana) / contract address (BSC), or the native sentinel. */
  tokenId: string
  symbol: string
  amountToken: number
  /** `null` when no price source had this token — render as "price unavailable". */
  currentUsdPrice: number | null
  usdValue: number | null
  mainCurrencyValue: number | null
}

export interface UseHoldingsResult {
  holdings: Holding[]
  mainCurrency: string
  isLoading: boolean
  isFetching: boolean
  /** True when at least one balance/price call failed this round — the
   * returned data may be incomplete or carried over from the last good
   * fetch, per §2's fallback-path description. */
  isStale: boolean
  error: string | null
}

interface AggregatedHolding {
  chain: ChainId
  tokenId: string
  symbol: string
  amountToken: number
}

interface HoldingsQueryData {
  holdings: Holding[]
  hadErrors: boolean
  errorMessage: string | null
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function holdingKey(chain: ChainId, tokenId: string): string {
  return `${chain}:${tokenId}`
}

/** Display fallback for an SPL mint with no resolved symbol — this app does
 * no on-chain metadata lookup, so an unrecognized token's only "name" is its
 * mint address; shorten it so it reads as an identifier, not a wall of text. */
function shortenMint(mint: string): string {
  return mint.length <= 10 ? mint : `${mint.slice(0, 4)}…${mint.slice(-4)}`
}

/** Fetches + aggregates raw per-chain balances for every wallet, never
 * throwing: a failing wallet just contributes nothing and flips `hadErrors`. */
async function collectBalances(
  wallets: WalletEntry[],
): Promise<{
  balances: Map<string, AggregatedHolding>
  hadErrors: boolean
  errors: string[]
}> {
  const balances = new Map<string, AggregatedHolding>()
  const errors: string[] = []

  function addAmount(
    chain: ChainId,
    tokenId: string,
    symbol: string,
    amount: number,
  ): void {
    if (!Number.isFinite(amount) || amount === 0) return
    const key = holdingKey(chain, tokenId)
    const existing = balances.get(key)
    if (existing) {
      existing.amountToken += amount
    } else {
      balances.set(key, { chain, tokenId, symbol, amountToken: amount })
    }
  }

  await Promise.all(
    wallets.map(async (wallet) => {
      try {
        if (wallet.chain === 'solana') {
          const [solBalance, tokenBalances] = await Promise.all([
            getSolBalance(wallet.address),
            getSolanaTokenBalances(wallet.address),
          ])
          addAmount('solana', NATIVE_SOL_MINT, 'SOL', solBalance)
          for (const token of tokenBalances) {
            addAmount('solana', token.mint, shortenMint(token.mint), token.uiAmount ?? 0)
          }
        } else {
          const [bnbBalance, tokenBalances] = await Promise.all([
            getBnbBalance(wallet.address),
            getBscTokenBalances(wallet.address, bscKnownTokens),
          ])
          addAmount('bsc', NATIVE_BNB_TOKEN_ID, 'BNB', bnbBalance)
          for (const tb of tokenBalances) {
            addAmount('bsc', tb.token.address, tb.token.symbol, tb.amount)
          }
        }
      } catch (err) {
        errors.push(describeError(err))
      }
    }),
  )

  return { balances, hadErrors: errors.length > 0, errors }
}

/** DefiLlama current-price lookup with a snapshot-fallback for known-major
 * symbols, per §2's fallback path. Never throws; a total failure resolves
 * to `{ price: null, failed: true }` so the caller can mark data stale. */
async function defillamaPriceWithSnapshotFallback(
  coinId: string,
  snapshotSymbol: string | undefined,
): Promise<{ price: number | null; failed: boolean }> {
  try {
    return { price: await getDefillamaCurrentPrice(coinId), failed: false }
  } catch (err) {
    if (snapshotSymbol) {
      try {
        const entry = await getSnapshotPrice(snapshotSymbol)
        if (entry) return { price: entry.usd, failed: true }
      } catch {
        // snapshot itself unreachable — fall through to "unavailable"
      }
    }
    void err
    return { price: null, failed: true }
  }
}

async function resolvePrices(
  holdings: AggregatedHolding[],
  mainCurrency: string,
): Promise<{
  pricesByKey: Map<string, number | null>
  mainCurrencyPrice: number | null
  hadErrors: boolean
}> {
  let hadErrors = false

  const solanaHoldings = holdings.filter((h) => h.chain === 'solana')
  const bscHoldings = holdings.filter((h) => h.chain === 'bsc')

  const mintFor = (h: AggregatedHolding): string =>
    h.tokenId === NATIVE_SOL_MINT ? WRAPPED_SOL_MINT : h.tokenId

  const currencyConfig = getCurrencyConfig(mainCurrency)
  const mainCurrencyIsFixedUnit = FIXED_UNIT_CURRENCIES.has(
    mainCurrency.toUpperCase(),
  )
  const mainCurrencyMint = !mainCurrencyIsFixedUnit
    ? currencyConfig?.solanaMint
    : undefined

  const jupiterMints = Array.from(
    new Set([
      ...solanaHoldings.map(mintFor),
      ...(mainCurrencyMint ? [mainCurrencyMint] : []),
    ]),
  )

  let jupiterPrices: Record<string, number> = {}
  if (jupiterMints.length > 0) {
    try {
      jupiterPrices = await getCurrentPricesJupiter(jupiterMints)
    } catch (err) {
      hadErrors = true
      void err
    }
  }

  const pricesByKey = new Map<string, number | null>()

  await Promise.all(
    solanaHoldings.map(async (h) => {
      const mint = mintFor(h)
      const jupiterPrice = jupiterPrices[mint]
      if (jupiterPrice !== undefined) {
        pricesByKey.set(holdingKey(h.chain, h.tokenId), jupiterPrice)
        return
      }
      const snapshotSymbol = h.tokenId === NATIVE_SOL_MINT ? 'SOL' : undefined
      const { price, failed } = await defillamaPriceWithSnapshotFallback(
        `solana:${mint}`,
        snapshotSymbol,
      )
      if (failed) hadErrors = true
      pricesByKey.set(holdingKey(h.chain, h.tokenId), price)
    }),
  )

  await Promise.all(
    bscHoldings.map(async (h) => {
      const coinId =
        h.tokenId === NATIVE_BNB_TOKEN_ID
          ? 'coingecko:binancecoin'
          : `bsc:${h.tokenId}`
      const snapshotSymbol = h.symbol
      const { price, failed } = await defillamaPriceWithSnapshotFallback(
        coinId,
        snapshotSymbol,
      )
      if (failed) hadErrors = true
      pricesByKey.set(holdingKey(h.chain, h.tokenId), price)
    }),
  )

  let mainCurrencyPrice: number | null = null
  if (mainCurrencyIsFixedUnit) {
    mainCurrencyPrice = 1
  } else if (mainCurrencyMint) {
    const jupiterPrice = jupiterPrices[mainCurrencyMint]
    if (jupiterPrice !== undefined) {
      mainCurrencyPrice = jupiterPrice
    } else {
      const { price, failed } = await defillamaPriceWithSnapshotFallback(
        `solana:${mainCurrencyMint}`,
        mainCurrency.toUpperCase(),
      )
      if (failed) hadErrors = true
      mainCurrencyPrice = price
    }
  } else if (currencyConfig?.coinId) {
    const { price, failed } = await defillamaPriceWithSnapshotFallback(
      currencyConfig.coinId,
      mainCurrency.toUpperCase(),
    )
    if (failed) hadErrors = true
    mainCurrencyPrice = price
  }

  return { pricesByKey, mainCurrencyPrice, hadErrors }
}

async function fetchHoldings(
  wallets: WalletEntry[],
  mainCurrency: string,
): Promise<HoldingsQueryData> {
  if (wallets.length === 0) {
    return { holdings: [], hadErrors: false, errorMessage: null }
  }

  const {
    balances,
    hadErrors: balanceErrors,
    errors: balanceErrorMessages,
  } = await collectBalances(wallets)
  const aggregated = Array.from(balances.values())

  const {
    pricesByKey,
    mainCurrencyPrice,
    hadErrors: priceErrors,
  } = await resolvePrices(aggregated, mainCurrency)

  const holdings: Holding[] = aggregated.map((h) => {
    const key = holdingKey(h.chain, h.tokenId)
    const currentUsdPrice = pricesByKey.get(key) ?? null
    const usdValue =
      currentUsdPrice !== null ? h.amountToken * currentUsdPrice : null
    const mainCurrencyValue =
      usdValue !== null && mainCurrencyPrice !== null && mainCurrencyPrice !== 0
        ? usdValue / mainCurrencyPrice
        : null
    return {
      key,
      chain: h.chain,
      tokenId: h.tokenId,
      symbol: h.symbol,
      amountToken: h.amountToken,
      currentUsdPrice,
      usdValue,
      mainCurrencyValue,
    }
  })

  const hadErrors = balanceErrors || priceErrors
  const errorMessage = hadErrors
    ? (balanceErrorMessages[0] ?? 'some price lookups failed')
    : null

  return { holdings, hadErrors, errorMessage }
}

/** Stable per-wallet cache key, order-independent so re-ordering `wallets[]`
 * (e.g. after a relabel) doesn't force a needless refetch. */
function walletsCacheKey(wallets: WalletEntry[]): string[] {
  return wallets.map((w) => `${w.chain}:${w.address}`).sort()
}

/**
 * Aggregated current holdings across every wallet in `wallets[]`, priced in
 * both USD and `mainCurrency` per §5.1.
 */
export function useHoldings(): UseHoldingsResult {
  const { wallets, mainCurrency } = useWallets()

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['holdings', walletsCacheKey(wallets), mainCurrency],
    queryFn: () => fetchHoldings(wallets, mainCurrency),
    placeholderData: keepPreviousData,
    retry: 2,
  })

  return {
    holdings: data?.holdings ?? [],
    mainCurrency,
    isLoading,
    isFetching,
    isStale: Boolean(data?.hadErrors) || isError,
    error: data?.errorMessage ?? null,
  }
}
