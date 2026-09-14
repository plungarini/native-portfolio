// Static fixture data for Phase 4 UI development — components are built and
// tested against this, not live hooks (live wiring is Phase 5, per
// ARCHITECTURE.md §9). Shapes mirror each hook's real return type exactly
// so swapping fixtures for live hooks in Phase 5 is a drop-in.

import type { Holding } from '../../hooks/useHoldings'
import type { ActivityRow } from '../../hooks/useActivity'
import type { PnlCalendarDay } from '../../hooks/usePnlCalendar'
import type { WalletEntry } from '../../types/state'

export const demoWallets: WalletEntry[] = [
  { chain: 'solana', address: '7RrqWam5ri2Yu6fUtiCp2dwqaydjJYMXz6HtCnQPGbDY', label: 'Main' },
  { chain: 'bsc', address: '0xDdfB5c6EacA4ebac981fEf8C71676976429dEa33', label: 'Trading' },
]

export const demoHoldings: Holding[] = [
  {
    key: 'solana:So11111111111111111111111111111111111111112',
    chain: 'solana',
    tokenId: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    amountToken: 12.5842,
    currentUsdPrice: 178.32,
    usdValue: 2243.4,
    mainCurrencyValue: 12.5842,
  },
  {
    key: 'solana:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    chain: 'solana',
    tokenId: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    amountToken: 540.12,
    currentUsdPrice: 1.0,
    usdValue: 540.12,
    mainCurrencyValue: 3.0289,
  },
  {
    key: 'solana:JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    chain: 'solana',
    tokenId: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    symbol: 'JUP',
    amountToken: 1820,
    currentUsdPrice: 0.62,
    usdValue: 1128.4,
    mainCurrencyValue: 6.3283,
  },
  {
    key: 'bsc:native:BNB',
    chain: 'bsc',
    tokenId: 'native:BNB',
    symbol: 'BNB',
    amountToken: 3.204,
    currentUsdPrice: 612.4,
    usdValue: 1962.34,
    mainCurrencyValue: 11.0072,
  },
  {
    key: 'bsc:0x55d398326f99059ff775485246999027b3197955',
    chain: 'bsc',
    tokenId: '0x55d398326f99059ff775485246999027b3197955',
    symbol: 'USDT',
    amountToken: 22384.93,
    currentUsdPrice: 1.0,
    usdValue: 22384.93,
    mainCurrencyValue: 125.55,
  },
  {
    key: 'bsc:0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
    chain: 'bsc',
    tokenId: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
    symbol: 'CAKE',
    amountToken: 410.5,
    currentUsdPrice: null,
    usdValue: null,
    mainCurrencyValue: null,
  },
]

const DAY = 86_400

export const demoActivity: ActivityRow[] = [
  {
    chain: 'solana',
    walletAddress: demoWallets[0].address,
    txHash: '4U5tA539MP7km5RZT61LmBy4o2aCrgDxnEWHmRAuTvFtPdHveNBMunWmsTS9iztBQq5hJAVcrq3nhCJF5nXR1CTX',
    timestamp: 1_789_400_000,
    legs: [
      { direction: 'out', chain: 'solana', tokenId: 'So11111111111111111111111111111111111111112', amount: 2, priceUsdAtTx: 172.1, valueUsd: 344.2, valueMainCurrency: 2 },
      { direction: 'in', chain: 'solana', tokenId: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', amount: 555, priceUsdAtTx: 0.62, valueUsd: 344.1, valueMainCurrency: 1.9994 },
    ],
  },
  {
    chain: 'bsc',
    walletAddress: demoWallets[1].address,
    txHash: '0x2a632f8a12d8b7dcfbe40ae33ea25c3725b212c877243518e3fc2f4fb16eb316',
    timestamp: 1_789_400_000 - DAY,
    legs: [
      { direction: 'out', chain: 'bsc', tokenId: '0x55d398326f99059ff775485246999027b3197955', amount: 500, priceUsdAtTx: 1.0, valueUsd: 500, valueMainCurrency: 0.8172 },
      { direction: 'in', chain: 'bsc', tokenId: 'native:BNB', amount: 0.817, priceUsdAtTx: 611.0, valueUsd: 499.2, valueMainCurrency: 0.8172 },
    ],
  },
  {
    chain: 'solana',
    walletAddress: demoWallets[0].address,
    txHash: '3xQqNa9v6wKp2rT8mYbHcVdE1sFgLj4nZoRuTiWpXcAeBqYhKfDsGmNpVtRcJhWzXn5uEbLoQyFvMnRsTdWkPjGz',
    timestamp: 1_789_400_000 - 2 * DAY,
    legs: [
      { direction: 'out', chain: 'solana', tokenId: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', amount: 300, priceUsdAtTx: 1.0, valueUsd: 300, valueMainCurrency: 1.7442 },
      { direction: 'in', chain: 'solana', tokenId: 'So11111111111111111111111111111111111111112', amount: 1.744, priceUsdAtTx: 172.0, valueUsd: 300, valueMainCurrency: 1.744 },
    ],
  },
]

/**
 * ~35 days of daily PnL, mixing profit/loss/flat/no-price days across the
 * 3-tier heatmap thresholds (§6: <$10, $10-100, >=$100 magnitude buckets).
 * Matches the real `DailyPnl` shape (`pnlUsd`/`pnlMainCurrency`/`avgUsdPrice`)
 * exactly — note ARCHITECTURE.md §6's `PnlCalendar` row mentions a
 * "trade count/volume for tooltip" field that doesn't actually exist on
 * this type; the tooltip can only show pnlUsd/pnlMainCurrency/avgUsdPrice
 * until a future phase adds trade-level data to the hook.
 */
export const demoPnlDays: PnlCalendarDay[] = Array.from({ length: 35 }, (_, i) => {
  const pattern = [0, 4.2, -8.5, 62, -140, 15.9, 0, 250, -30, -3.1]
  const pnlUsd = pattern[i % pattern.length]
  const date = new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10)
  // Every 11th day simulates "no historical average price available".
  const avgUsdPrice = i % 11 === 10 ? null : 178.32
  return {
    date,
    pnlUsd,
    pnlMainCurrency: avgUsdPrice !== null ? pnlUsd / avgUsdPrice : null,
    avgUsdPrice,
  }
})
