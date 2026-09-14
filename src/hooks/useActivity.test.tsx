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

/** A single 2-leg swap fixture: sells 100 USDC, receives 0.5 SOL — the same
 * shape as `solana/deriveSwaps.test.ts`'s verified fixture, reused here so
 * the real (unmocked) `deriveSwap` classification runs against realistic
 * data. */
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
  getParsedTransaction: vi.fn(),
}))
vi.mock('../lib/chains/bsc/bscRpcClient', () => ({
  rpcRequest: vi.fn(),
  getTransferLogs: vi.fn(),
  hexToBigInt: (hex: string) => BigInt(hex),
  blockNumberToHex: (n: number) => `0x${n.toString(16)}`,
}))
vi.mock('../lib/prices/historicalPriceCache', () => ({
  getCachedHistoricalPrice: vi.fn(),
}))

import {
  getParsedTransaction,
  getSignatures,
} from '../lib/chains/solana/solanaRpcClient'
import { getCachedHistoricalPrice } from '../lib/prices/historicalPriceCache'
import { useActivity } from './useActivity'
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

describe('useActivity', () => {
  it('classifies a single historical swap and prices each leg at the tx timestamp', async () => {
    vi.mocked(getSignatures).mockResolvedValue(SIGNATURES)
    vi.mocked(getParsedTransaction).mockResolvedValue(SWAP_TX)
    vi.mocked(getCachedHistoricalPrice).mockImplementation(
      async (coinId: string) => {
        if (coinId === `solana:${USDC_MINT}`) return 1
        if (coinId === 'coingecko:solana') return 150
        return null
      },
    )

    const wrapper = createWrapper()
    const wallets = renderHook(() => useWallets(), { wrapper })
    await waitFor(() => expect(wallets.result.current.isLoading).toBe(false))
    wallets.result.current.addWallet({
      chain: 'solana',
      address: WALLET_ADDRESS,
    })
    await waitFor(() => expect(wallets.result.current.wallets).toHaveLength(1))

    const { result } = renderHook(() => useActivity(), { wrapper })

    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    expect(result.current.isStale).toBe(false)

    const row = result.current.rows[0]
    expect(row.txHash).toBe('swap-sig')
    expect(row.timestamp).toBe(TX_TIMESTAMP)
    expect(row.legs).toHaveLength(2)

    const usdcLeg = row.legs.find((leg) => leg.tokenId === USDC_MINT)!
    expect(usdcLeg.direction).toBe('out')
    expect(usdcLeg.amount).toBeCloseTo(100)
    expect(usdcLeg.priceUsdAtTx).toBe(1)
    expect(usdcLeg.valueUsd).toBeCloseTo(100)
    expect(usdcLeg.valueMainCurrency).toBeCloseTo(100 / 150)

    const solLeg = row.legs.find((leg) => leg.tokenId !== USDC_MINT)!
    expect(solLeg.direction).toBe('in')
    expect(solLeg.amount).toBeCloseTo(0.5)
    expect(solLeg.priceUsdAtTx).toBe(150)
    expect(solLeg.valueUsd).toBeCloseTo(75)
    expect(solLeg.valueMainCurrency).toBeCloseTo(0.5)
  })
})
