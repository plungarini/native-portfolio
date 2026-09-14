import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivityTable } from './index'
import { demoActivity } from '../../lib/fixtures/demoData'
import type { ActivityRow } from '../../hooks/useActivity'

describe('ActivityTable', () => {
  it('groups rows into one TableSection per UTC calendar day', () => {
    render(<ActivityTable rows={demoActivity} mainCurrency="SOL" />)
    expect(screen.getAllByText(/activities$/).length).toBeGreaterThanOrEqual(2)
  })

  it('renders received legs in success color and sent legs in destructive color', () => {
    render(<ActivityTable rows={demoActivity} mainCurrency="SOL" />)
    const received = screen.getAllByText(/\+555/)[0]
    const sent = screen.getAllByText(/-2 /)[0]
    expect(received).toHaveClass('text-success')
    expect(sent).toHaveClass('text-destructive')
  })

  it('shows "price unavailable" when a leg has no valueMainCurrency', () => {
    const rows: ActivityRow[] = [
      {
        chain: 'solana',
        walletAddress: 'wallet1',
        txHash: '1234567890abcdef',
        timestamp: 1_789_400_000,
        legs: [
          {
            direction: 'in',
            chain: 'solana',
            tokenId: 'token1',
            amount: 10,
            priceUsdAtTx: null,
            valueUsd: null,
            valueMainCurrency: null,
          },
        ],
      },
    ]
    render(<ActivityTable rows={rows} mainCurrency="SOL" />)
    expect(screen.getByText(/price unavailable/)).toBeInTheDocument()
  })

  it('renders empty state when there are no rows', () => {
    render(<ActivityTable rows={[]} mainCurrency="SOL" />)
    expect(screen.getByText('No activity yet')).toBeInTheDocument()
  })
})
