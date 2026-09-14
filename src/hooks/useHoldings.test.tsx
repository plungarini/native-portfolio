import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const WALLET_ADDRESS = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
const WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112'

vi.mock('../lib/chains/solana/solanaRpcClient', () => ({
  getSolBalance: vi.fn(),
  getTokenBalances: vi.fn(),
}))
vi.mock('../lib/chains/bsc/bscRpcClient', () => ({
  getBnbBalance: vi.fn(),
  getTokenBalances: vi.fn(),
}))
vi.mock('../lib/prices/jupiterPriceV3', () => ({
  getCurrentPricesJupiter: vi.fn(),
}))
vi.mock('../lib/prices/defillama', () => ({
  getCurrentPrice: vi.fn(),
}))
vi.mock('../lib/prices/snapshotFallback', () => ({
  getSnapshotPrice: vi.fn(),
}))

import {
  getSolBalance,
  getTokenBalances as getSolanaTokenBalances,
} from '../lib/chains/solana/solanaRpcClient'
import {
  getBnbBalance,
  getTokenBalances as getBscTokenBalances,
} from '../lib/chains/bsc/bscRpcClient'
import { getCurrentPricesJupiter } from '../lib/prices/jupiterPriceV3'
import { getCurrentPrice } from '../lib/prices/defillama'
import { useHoldings } from './useHoldings'
import { useWallets } from './useWallets'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

beforeEach(() => {
  window.localStorage.clear()
  window.location.hash = ''
  vi.clearAllMocks()
})

describe('useHoldings', () => {
  it('aggregates a single wallet/single-holding fixture into a priced holding row', async () => {
    vi.mocked(getSolBalance).mockResolvedValue(2.5)
    vi.mocked(getSolanaTokenBalances).mockResolvedValue([])
    vi.mocked(getCurrentPricesJupiter).mockResolvedValue({
      [WRAPPED_SOL_MINT]: 150,
    })
    vi.mocked(getBnbBalance).mockResolvedValue(0)
    vi.mocked(getBscTokenBalances).mockResolvedValue([])
    vi.mocked(getCurrentPrice).mockResolvedValue(null)

    const wrapper = createWrapper()

    // Seed wallets[] via the real useWallets hook (backed by the real
    // encoding/localStorage layer) so this is an end-to-end wiring test,
    // not just a unit test of the pricing math in isolation.
    const wallets = renderHook(() => useWallets(), { wrapper })
    await waitFor(() => expect(wallets.result.current.isLoading).toBe(false))
    wallets.result.current.addWallet({
      chain: 'solana',
      address: WALLET_ADDRESS,
    })
    await waitFor(() => expect(wallets.result.current.wallets).toHaveLength(1))

    const { result } = renderHook(() => useHoldings(), { wrapper })

    await waitFor(() => expect(result.current.holdings).toHaveLength(1))

    expect(result.current.isStale).toBe(false)
    expect(result.current.mainCurrency).toBe('SOL')

    const holding = result.current.holdings[0]
    expect(holding.chain).toBe('solana')
    expect(holding.symbol).toBe('SOL')
    expect(holding.amountToken).toBe(2.5)
    expect(holding.currentUsdPrice).toBe(150)
    expect(holding.usdValue).toBeCloseTo(375)
    // mainCurrency is SOL itself, so mainCurrencyValue must round-trip back
    // to the raw token amount (§5.1's worked example).
    expect(holding.mainCurrencyValue).toBeCloseTo(2.5)

    expect(getSolBalance).toHaveBeenCalledWith(WALLET_ADDRESS)
    expect(getCurrentPricesJupiter).toHaveBeenCalledWith([WRAPPED_SOL_MINT])
  })

  it('degrades gracefully (isStale, no throw) when a chain client call fails', async () => {
    vi.mocked(getSolBalance).mockRejectedValue(new Error('RPC unreachable'))
    vi.mocked(getSolanaTokenBalances).mockResolvedValue([])
    vi.mocked(getCurrentPricesJupiter).mockResolvedValue({})
    vi.mocked(getCurrentPrice).mockResolvedValue(null)

    const wrapper = createWrapper()
    const wallets = renderHook(() => useWallets(), { wrapper })
    await waitFor(() => expect(wallets.result.current.isLoading).toBe(false))
    wallets.result.current.addWallet({
      chain: 'solana',
      address: WALLET_ADDRESS,
    })
    await waitFor(() => expect(wallets.result.current.wallets).toHaveLength(1))

    const { result } = renderHook(() => useHoldings(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.holdings).toEqual([])
    expect(result.current.isStale).toBe(true)
    expect(result.current.error).toContain('RPC unreachable')
  })
})
