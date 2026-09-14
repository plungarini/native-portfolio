import { describe, expect, it } from 'vitest'
import { deriveActivity, isActivityFeedEligible } from './deriveSwaps'
import type { TransferLogEntry } from './bscRpcClient'

const WALLET = '0x000000000000000000000000000000000000AA'
const OTHER_1 = '0x000000000000000000000000000000000000BB'
const OTHER_2 = '0x000000000000000000000000000000000000CC'
const TOKEN_A = '0x1111111111111111111111111111111111111111'
const TOKEN_B = '0x2222222222222222222222222222222222222222'

function log(overrides: Partial<TransferLogEntry>): TransferLogEntry {
  return {
    txHash: '0xtx',
    blockNumber: 100,
    logIndex: 0,
    tokenAddress: TOKEN_A,
    from: OTHER_1,
    to: WALLET,
    amountRaw: 1_000_000_000_000_000_000n,
    amount: 1,
    ...overrides,
  }
}

describe('deriveActivity', () => {
  it('classifies a same-tx outgoing+incoming pair as a two-legged swap', () => {
    const logs: TransferLogEntry[] = [
      log({
        txHash: '0xswap',
        blockNumber: 200,
        logIndex: 0,
        tokenAddress: TOKEN_A,
        from: WALLET,
        to: OTHER_1,
        amountRaw: 5_000_000_000_000_000_000n,
        amount: 5,
      }),
      log({
        txHash: '0xswap',
        blockNumber: 200,
        logIndex: 1,
        tokenAddress: TOKEN_B,
        from: OTHER_2,
        to: WALLET,
        amountRaw: 2_500_000_000n,
        amount: 2.5,
      }),
    ]

    const activities = deriveActivity(WALLET, logs)

    expect(activities).toHaveLength(1)
    expect(activities[0]).toEqual({
      type: 'swap',
      txHash: '0xswap',
      blockNumber: 200,
      legs: [
        {
          direction: 'out',
          tokenAddress: TOKEN_A,
          counterparty: OTHER_1,
          amountRaw: 5_000_000_000_000_000_000n,
          amount: 5,
        },
        {
          direction: 'in',
          tokenAddress: TOKEN_B,
          counterparty: OTHER_2,
          amountRaw: 2_500_000_000n,
          amount: 2.5,
        },
      ],
    })
  })

  it('classifies a one-sided incoming-only leg as a non-swap transfer', () => {
    const logs: TransferLogEntry[] = [
      log({
        txHash: '0xairdrop',
        blockNumber: 150,
        logIndex: 0,
        tokenAddress: TOKEN_A,
        from: OTHER_1,
        to: WALLET,
        amountRaw: 10_000_000_000_000_000_000n,
        amount: 10,
      }),
    ]

    const activities = deriveActivity(WALLET, logs)

    expect(activities).toHaveLength(1)
    expect(activities[0].type).toBe('transfer')
    expect(activities[0].legs).toEqual([
      {
        direction: 'in',
        tokenAddress: TOKEN_A,
        counterparty: OTHER_1,
        amountRaw: 10_000_000_000_000_000_000n,
        amount: 10,
      },
    ])
  })

  it('classifies a one-sided outgoing-only leg as a non-swap transfer', () => {
    const logs: TransferLogEntry[] = [
      log({
        txHash: '0xgift',
        blockNumber: 160,
        logIndex: 0,
        from: WALLET,
        to: OTHER_1,
      }),
    ]

    const activities = deriveActivity(WALLET, logs)
    expect(activities[0].type).toBe('transfer')
  })

  it('groups multiple transactions independently and sorts newest-first', () => {
    const logs: TransferLogEntry[] = [
      log({ txHash: '0xold', blockNumber: 10, from: OTHER_1, to: WALLET }),
      log({ txHash: '0xnew', blockNumber: 999, from: OTHER_1, to: WALLET }),
    ]

    const activities = deriveActivity(WALLET, logs)
    expect(activities.map((a) => a.txHash)).toEqual(['0xnew', '0xold'])
  })

  it('ignores legs where the wallet is neither sender nor recipient', () => {
    const logs: TransferLogEntry[] = [log({ from: OTHER_1, to: OTHER_2 })]
    expect(deriveActivity(WALLET, logs)).toEqual([])
  })
})

describe('isActivityFeedEligible (§3.4 two-sided-transfer rule)', () => {
  it('includes swaps and excludes one-sided transfers', () => {
    const swapLogs: TransferLogEntry[] = [
      log({
        txHash: '0xswap',
        from: WALLET,
        to: OTHER_1,
        tokenAddress: TOKEN_A,
      }),
      log({
        txHash: '0xswap',
        from: OTHER_2,
        to: WALLET,
        tokenAddress: TOKEN_B,
      }),
    ]
    const transferLogs: TransferLogEntry[] = [
      log({ txHash: '0xincoming-only', from: OTHER_1, to: WALLET }),
    ]

    const activities = deriveActivity(WALLET, [...swapLogs, ...transferLogs])
    const eligible = activities.filter(isActivityFeedEligible)

    expect(eligible.map((a) => a.txHash)).toEqual(['0xswap'])
  })
})
