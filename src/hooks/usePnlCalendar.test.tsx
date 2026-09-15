import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type {
  ParsedTransactionResult,
  SignatureInfo,
} from '../lib/chains/solana/solanaRpcClient'

const WALLET_ADDRESS = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const TX_TIMESTAMP = 1_700_000_000
const EXPECTED_DAY = new Date(TX_TIMESTAMP * 1000).toISOString().slice(0, 10)

/** Same single 2-leg swap fixture as `useActivity.test.tsx`: sells 100
 * USDC (no prior buy lot, so it's a zero-cost-basis sale) and receives 0.5
 * SOL (a buy leg, which produces no realized-PnL entry on its own). */
const SWAP_TX: ParsedTransactionResult = {
  slot: 12345,
  blockTime: TX_TIMESTAMP,
  meta: {
    err: null,
    fee: 5000,
    preBalances: [2_000_000_000, 0],
    postBalances: [2_499_995_000, 0],
    preTokenBalances: [
      {
        accountIndex: 1,
        mint: USDC_MINT,
        owner: WALLET_ADDRESS,
        uiTokenAmount: {
          amount: '100000000',
          decimals: 6,
          uiAmount: 100,
          uiAmountString: '100',
        },
      },
    ],
    postTokenBalances: [
      {
        accountIndex: 1,
        mint: USDC_MINT,
        owner: WALLET_ADDRESS,
        uiTokenAmount: {
          amount: '0',
          decimals: 6,
          uiAmount: 0,
          uiAmountString: '0',
        },
      },
    ],
  },
  transaction: {
    signatures: ['swap-sig'],
    message: {
      accountKeys: [
        { pubkey: WALLET_ADDRESS, signer: true, writable: true },
        {
          pubkey: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
          signer: false,
          writable: true,
        },
      ],
    },
  },
}

const SIGNATURES: SignatureInfo[] = [
  {
    signature: 'swap-sig',
    slot: 12345,
    err: null,
    memo: null,
    blockTime: TX_TIMESTAMP,
  },
]

vi.mock('../lib/chains/solana/solanaRpcClient', () => ({
  getSignatures: vi.fn(),
  getParsedTransactionsBatch: vi.fn(),
}))
vi.mock('../lib/chains/bsc/bscRpcClient', () => ({
  rpcRequest: vi.fn(),
  getTransferLogs: vi.fn(),
  hexToBigInt: (hex: string) => BigInt(hex),
  blockNumberToHex: (n: number) => `0x${n.toString(16)}`,
}))
vi.mock('../lib/prices/historicalPriceCache', () => ({
  getCachedHistoricalPrice: vi.fn(),
  getCachedDailyAveragePrice: vi.fn(),
}))
vi.mock('../lib/tokens/jupiterTokenMetadata', () => ({
  getTokenMetadata: vi.fn().mockResolvedValue({}),
}))

import {
  getParsedTransactionsBatch,
  getSignatures,
} from '../lib/chains/solana/solanaRpcClient'
import {
  getCachedDailyAveragePrice,
  getCachedHistoricalPrice,
} from '../lib/prices/historicalPriceCache'
import { usePnlCalendar } from './usePnlCalendar'
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

describe('usePnlCalendar', () => {
  it('feeds a single historical swap through FIFO cost-basis + calendar aggregation', async () => {
    vi.mocked(getSignatures).mockResolvedValue(SIGNATURES)
    vi.mocked(getParsedTransactionsBatch).mockResolvedValue([SWAP_TX])
    vi.mocked(getCachedHistoricalPrice).mockImplementation(
      async (coinId: string) => {
        if (coinId === `solana:${USDC_MINT}`) return 1
        if (coinId === 'coingecko:solana') return 150
        return null
      },
    )
    vi.mocked(getCachedDailyAveragePrice).mockResolvedValue(148)

    const wrapper = createWrapper()
    const wallets = renderHook(() => useWallets(), { wrapper })
    await waitFor(() => expect(wallets.result.current.isLoading).toBe(false))
    wallets.result.current.addWallet({
      chain: 'solana',
      address: WALLET_ADDRESS,
    })
    await waitFor(() => expect(wallets.result.current.wallets).toHaveLength(1))

    const { result } = renderHook(() => usePnlCalendar(), { wrapper })

    await waitFor(() => expect(result.current.days).toHaveLength(1))
    expect(result.current.isStale).toBe(false)

    const day = result.current.days[0]
    expect(day.date).toBe(EXPECTED_DAY)
    // The 100 USDC sale has no prior buy lot for USDC, so per
    // `fifoCostBasis.ts`'s over-sell rule its whole value is realized PnL;
    // the 0.5 SOL leg is a buy, which opens a lot but produces no PnL entry.
    expect(day.pnlUsd).toBeCloseTo(100)
    expect(day.avgUsdPrice).toBe(148)
    expect(day.pnlMainCurrency).toBeCloseTo(100 / 148)

    expect(getCachedDailyAveragePrice).toHaveBeenCalledWith(
      'coingecko:solana',
      expect.any(Number),
    )
  })
})
