import { describe, expect, it } from 'vitest'
import { NATIVE_SOL_MINT, deriveSwap } from './deriveSwaps'
import type { ParsedTransactionResult } from './solanaRpcClient'

const WALLET = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
const OTHER_WALLET = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const TOKEN_A_MINT = 'TokenAMintXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
const TOKEN_B_MINT = 'TokenBMintXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
const TOKEN_C_MINT = 'TokenCMintXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
const AIRDROP_MINT = 'AirdropMintXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'

/** A real 2-leg swap fixture: the wallet sells 100 USDC and receives 0.5 SOL
 * (e.g. a Jupiter aggregator route), with the wallet as fee payer at
 * account index 0. */
const TWO_LEG_SWAP_FIXTURE: ParsedTransactionResult = {
  slot: 12345,
  blockTime: 1_700_000_000,
  meta: {
    err: null,
    fee: 5000,
    preBalances: [2_000_000_000, 0],
    postBalances: [2_499_995_000, 0],
    preTokenBalances: [
      {
        accountIndex: 1,
        mint: USDC_MINT,
        owner: WALLET,
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
        owner: WALLET,
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
    signatures: ['2-leg-swap-sig'],
    message: {
      accountKeys: [
        { pubkey: WALLET, signer: true, writable: true },
        {
          pubkey: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
          signer: false,
          writable: true,
        },
      ],
    },
  },
}

/** A one-sided transfer fixture (airdrop-like): the wallet receives a new
 * token out of nowhere, no offsetting outgoing leg, no native SOL change
 * for the wallet (it's not the fee payer / not present in accountKeys). */
const AIRDROP_FIXTURE: ParsedTransactionResult = {
  slot: 22222,
  blockTime: 1_700_100_000,
  meta: {
    err: null,
    fee: 5000,
    preBalances: [10_000_000, 0],
    postBalances: [9_995_000, 0],
    preTokenBalances: [],
    postTokenBalances: [
      {
        accountIndex: 1,
        mint: AIRDROP_MINT,
        owner: WALLET,
        uiTokenAmount: {
          amount: '5000',
          decimals: 2,
          uiAmount: 50,
          uiAmountString: '50',
        },
      },
    ],
  },
  transaction: {
    signatures: ['airdrop-sig'],
    message: {
      accountKeys: [
        { pubkey: OTHER_WALLET, signer: true, writable: true },
        {
          pubkey: 'AirdropDestinationTokenAccountXXXXXXXXXXXXX',
          signer: false,
          writable: true,
        },
      ],
    },
  },
}

/** A multi-hop swap fixture: the wallet sells TOKEN_A and receives a split
 * of TOKEN_B and TOKEN_C in the same transaction (3 non-zero deltas). */
const MULTI_HOP_SWAP_FIXTURE: ParsedTransactionResult = {
  slot: 33333,
  blockTime: 1_700_200_000,
  meta: {
    err: null,
    fee: 5000,
    preBalances: [3_000_000_000],
    postBalances: [2_999_995_000],
    preTokenBalances: [
      {
        accountIndex: 1,
        mint: TOKEN_A_MINT,
        owner: WALLET,
        uiTokenAmount: {
          amount: '10000',
          decimals: 2,
          uiAmount: 100,
          uiAmountString: '100',
        },
      },
      {
        accountIndex: 2,
        mint: TOKEN_B_MINT,
        owner: WALLET,
        uiTokenAmount: {
          amount: '0',
          decimals: 2,
          uiAmount: 0,
          uiAmountString: '0',
        },
      },
      {
        accountIndex: 3,
        mint: TOKEN_C_MINT,
        owner: WALLET,
        uiTokenAmount: {
          amount: '0',
          decimals: 2,
          uiAmount: 0,
          uiAmountString: '0',
        },
      },
    ],
    postTokenBalances: [
      {
        accountIndex: 1,
        mint: TOKEN_A_MINT,
        owner: WALLET,
        uiTokenAmount: {
          amount: '0',
          decimals: 2,
          uiAmount: 0,
          uiAmountString: '0',
        },
      },
      {
        accountIndex: 2,
        mint: TOKEN_B_MINT,
        owner: WALLET,
        uiTokenAmount: {
          amount: '4000',
          decimals: 2,
          uiAmount: 40,
          uiAmountString: '40',
        },
      },
      {
        accountIndex: 3,
        mint: TOKEN_C_MINT,
        owner: WALLET,
        uiTokenAmount: {
          amount: '6000',
          decimals: 2,
          uiAmount: 60,
          uiAmountString: '60',
        },
      },
    ],
  },
  transaction: {
    signatures: ['multi-hop-sig'],
    message: {
      accountKeys: [
        { pubkey: WALLET, signer: true, writable: true },
        {
          pubkey: 'RouteAccount1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          signer: false,
          writable: true,
        },
        {
          pubkey: 'RouteAccount2XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          signer: false,
          writable: true,
        },
        {
          pubkey: 'RouteAccount3XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          signer: false,
          writable: true,
        },
      ],
    },
  },
}

describe('deriveSwap', () => {
  it('classifies a real 2-leg swap as a swap, not excluded from Activity', () => {
    const result = deriveSwap(TWO_LEG_SWAP_FIXTURE, WALLET)

    expect(result.isSwap).toBe(true)
    expect(result.excludeFromActivity).toBe(false)
    expect(result.deltas).toEqual(
      expect.arrayContaining([
        { mint: USDC_MINT, delta: -100 },
        { mint: NATIVE_SOL_MINT, delta: 0.5 },
      ]),
    )
    expect(result.deltas).toHaveLength(2)
  })

  it('classifies a one-sided transfer (airdrop) as excluded/non-swap', () => {
    const result = deriveSwap(AIRDROP_FIXTURE, WALLET)

    expect(result.isSwap).toBe(false)
    expect(result.excludeFromActivity).toBe(true)
    expect(result.deltas).toEqual([{ mint: AIRDROP_MINT, delta: 50 }])
  })

  it('handles a multi-hop swap (3+ non-zero deltas) without throwing, classified as a swap', () => {
    expect(() => deriveSwap(MULTI_HOP_SWAP_FIXTURE, WALLET)).not.toThrow()

    const result = deriveSwap(MULTI_HOP_SWAP_FIXTURE, WALLET)

    expect(result.isSwap).toBe(true)
    expect(result.excludeFromActivity).toBe(false)
    expect(result.deltas).toHaveLength(3)
    expect(result.deltas).toEqual(
      expect.arrayContaining([
        { mint: TOKEN_A_MINT, delta: -100 },
        { mint: TOKEN_B_MINT, delta: 40 },
        { mint: TOKEN_C_MINT, delta: 60 },
      ]),
    )
  })

  it('returns no deltas and excludes from Activity when meta is missing', () => {
    const noMetaTx: ParsedTransactionResult = {
      ...TWO_LEG_SWAP_FIXTURE,
      meta: null,
    }

    const result = deriveSwap(noMetaTx, WALLET)

    expect(result.deltas).toEqual([])
    expect(result.isSwap).toBe(false)
    expect(result.excludeFromActivity).toBe(true)
  })
})
