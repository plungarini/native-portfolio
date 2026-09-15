import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { TransferSummaryCard } from './index'
import type { TransferRow } from '../../hooks/useActivity'

afterEach(cleanup)

function leg(valueUsd: number | null, valueMainCurrency: number | null) {
  return {
    direction: 'in' as const,
    chain: 'solana' as const,
    tokenId: 'mint1',
    amount: 1,
    symbol: 'SOL',
    name: 'Solana',
    iconUrl: null,
    priceUsdAtTx: 100,
    valueUsd,
    valueMainCurrency,
  }
}

function transfer(direction: 'deposit' | 'withdrawal', legs: ReturnType<typeof leg>[]): TransferRow {
  return {
    chain: 'solana',
    walletAddress: 'wallet1',
    txHash: `tx-${Math.random()}`,
    timestamp: 1_700_000_000,
    direction,
    legs,
  }
}

describe('TransferSummaryCard', () => {
  it('sums only rows matching its direction, leading with main currency', () => {
    const transfers: TransferRow[] = [
      transfer('deposit', [leg(100, 1)]),
      transfer('deposit', [leg(50, 0.5)]),
      transfer('withdrawal', [leg(30, 0.3)]),
    ]
    render(<TransferSummaryCard transfers={transfers} direction="deposit" mainCurrency="SOL" />)

    expect(screen.getByText('Deposits')).toBeInTheDocument()
    expect(screen.getByText('1.5 SOL')).toBeInTheDocument()
    expect(screen.getByText('$150.00')).toBeInTheDocument()
    expect(screen.getByText('2 transactions')).toBeInTheDocument()
    expect(screen.queryByText(/30/)).not.toBeInTheDocument()
  })

  it('sums across every leg of a multi-leg transfer', () => {
    const transfers: TransferRow[] = [transfer('deposit', [leg(100, 1), leg(50, 0.5)])]
    render(<TransferSummaryCard transfers={transfers} direction="deposit" mainCurrency="SOL" />)
    expect(screen.getByText('1.5 SOL')).toBeInTheDocument()
    expect(screen.getByText('1 transaction')).toBeInTheDocument()
  })

  it('renders a single figure with no redundant USD line when mainCurrency is USD', () => {
    const transfers: TransferRow[] = [transfer('withdrawal', [leg(100, 1)])]
    render(<TransferSummaryCard transfers={transfers} direction="withdrawal" mainCurrency="USD" />)
    expect(screen.getByText('Withdrawals')).toBeInTheDocument()
    expect(screen.getAllByText('$100.00')).toHaveLength(1)
  })

  it('renders zero state without crashing when there are no matching transfers', () => {
    render(<TransferSummaryCard transfers={[]} direction="deposit" mainCurrency="SOL" />)
    expect(screen.getByText('price unavailable')).toBeInTheDocument()
    expect(screen.getByText('0 transactions')).toBeInTheDocument()
  })
})
