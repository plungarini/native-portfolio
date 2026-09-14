// Decoded wallets[] from URL/localStorage state — implemented in Phase 2/5, per ARCHITECTURE.md §4/§7.
//
// This hook is the single source of truth for the decoded `AppState`
// (`wallets[]` + `mainCurrency`, per §4's schema). It is backed by a
// react-query cache entry (rather than plain `useState`) so the other data
// hooks (`useHoldings`/`useActivity`/`usePnlCalendar`) can simply call
// `useWallets()` themselves and automatically re-run whenever the wallet
// list or main currency changes, without prop-drilling state through the
// component tree.
//
// Every mutation (add/remove/relabel wallet, change main currency) re-encodes
// and persists the whole state synchronously via
// `lib/encoding/storagePersistence.ts#persistState` (§4 points 1-4), then
// writes the new state straight into the react-query cache so subscribers
// re-render immediately (no extra round-trip through `location.hash`).

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FORMAT_VERSION } from '../lib/encoding/accountCodec'
import {
  loadInitialState,
  persistState,
} from '../lib/encoding/storagePersistence'
import { DEFAULT_MAIN_CURRENCY } from '../config/currencies'
import type { AppState, WalletEntry } from '../types/state'
import type { ChainId } from '../types/chain'

/** Shared react-query key for the decoded account state. Exported so other
 * hooks/tests can read the same cache entry directly if ever needed. */
export const walletsQueryKey = ['app-state'] as const

function emptyState(): AppState {
  return {
    version: FORMAT_VERSION,
    mainCurrency: DEFAULT_MAIN_CURRENCY,
    wallets: [],
  }
}

export interface UseWalletsResult {
  wallets: WalletEntry[]
  mainCurrency: string
  /** True only while the very first read of hash/localStorage is in flight. */
  isLoading: boolean
  addWallet: (wallet: WalletEntry) => void
  removeWallet: (chain: ChainId, address: string) => void
  relabelWallet: (
    chain: ChainId,
    address: string,
    label: string | undefined,
  ) => void
  setMainCurrency: (mainCurrency: string) => void
}

/**
 * Reads the decoded `AppState` (wallets[] + mainCurrency) from the URL
 * hash/localStorage encoding layer, and exposes add/remove/relabel actions
 * that re-encode and persist the mutated state, per §4 points 1-4.
 */
export function useWallets(): UseWalletsResult {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: walletsQueryKey,
    // `loadInitialState` is synchronous but cheap; wrapping it in a query
    // lets every hook in the tree share one cached, reactive copy of state.
    queryFn: () => Promise.resolve(loadInitialState()),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const mutate = useCallback(
    (updater: (state: AppState) => AppState) => {
      const current =
        queryClient.getQueryData<AppState>(walletsQueryKey) ?? emptyState()
      const next = updater(current)
      persistState(next)
      queryClient.setQueryData(walletsQueryKey, next)
    },
    [queryClient],
  )

  const addWallet = useCallback(
    (wallet: WalletEntry) => {
      mutate((state) => ({ ...state, wallets: [...state.wallets, wallet] }))
    },
    [mutate],
  )

  const removeWallet = useCallback(
    (chain: ChainId, address: string) => {
      mutate((state) => ({
        ...state,
        wallets: state.wallets.filter(
          (w) => !(w.chain === chain && w.address === address),
        ),
      }))
    },
    [mutate],
  )

  const relabelWallet = useCallback(
    (chain: ChainId, address: string, label: string | undefined) => {
      mutate((state) => ({
        ...state,
        wallets: state.wallets.map((w) =>
          w.chain === chain && w.address === address ? { ...w, label } : w,
        ),
      }))
    },
    [mutate],
  )

  const setMainCurrency = useCallback(
    (mainCurrency: string) => {
      mutate((state) => ({ ...state, mainCurrency }))
    },
    [mutate],
  )

  return {
    wallets: data?.wallets ?? [],
    mainCurrency: data?.mainCurrency ?? DEFAULT_MAIN_CURRENCY,
    isLoading,
    addWallet,
    removeWallet,
    relabelWallet,
    setMainCurrency,
  }
}
