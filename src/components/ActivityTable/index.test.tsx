import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ActivityTable } from './index'
import { demoActivity } from '../../lib/fixtures/demoData'
import type { ActivityRow } from '../../hooks/useActivity'
import { formatAmount } from '../../lib/format/number'
import { formatMainCurrency } from '../../lib/format/currency'

afterEach(cleanup)

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
            symbol: 'TOK1',
            name: 'Token One',
            iconUrl: null,
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

  it('renders a TokenIcon fallback for each leg using its resolved symbol', () => {
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
            tokenId: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            amount: 10,
            symbol: 'USDC',
            name: 'USD Coin',
            iconUrl: null,
            priceUsdAtTx: 1,
            valueUsd: 10,
            valueMainCurrency: 10,
          },
        ],
      },
    ]
    render(<ActivityTable rows={rows} mainCurrency="SOL" />)
    expect(screen.getByText('US')).toBeInTheDocument()
  })

  it('links Tx hash to solscan for solana rows and bscscan for bsc rows', () => {
    const rows: ActivityRow[] = [
      {
        chain: 'solana',
        walletAddress: 'wallet1',
        txHash: 'sol1234567890abcdef',
        timestamp: 1_789_400_000,
        legs: [],
      },
      {
        chain: 'bsc',
        walletAddress: 'wallet2',
        txHash: 'bsc1234567890abcdef',
        timestamp: 1_789_400_000,
        legs: [],
      },
    ]
    render(<ActivityTable rows={rows} mainCurrency="SOL" />)
    const links = screen.getAllByRole('link')
    const solLink = links.find((link) =>
      link.getAttribute('href')?.includes('sol1234567890abcdef'),
    )
    const bscLink = links.find((link) =>
      link.getAttribute('href')?.includes('bsc1234567890abcdef'),
    )
    expect(solLink).toHaveAttribute('href', 'https://solscan.io/tx/sol1234567890abcdef')
    expect(solLink).toHaveAttribute('target', '_blank')
    expect(solLink).toHaveAttribute('rel', 'noreferrer noopener')
    expect(bscLink).toHaveAttribute('href', 'https://bscscan.com/tx/bsc1234567890abcdef')
  })

  it('applies a hover transition class to each activity row', () => {
    const rows: ActivityRow[] = [
      {
        chain: 'solana',
        walletAddress: 'wallet1',
        txHash: '1234567890abcdef',
        timestamp: 1_789_400_000,
        legs: [],
      },
    ]
    const { container } = render(<ActivityTable rows={rows} mainCurrency="SOL" />)
    const row = container.querySelector('tbody tr')
    expect(row).toHaveClass('hover:bg-muted/30')
    expect(row).toHaveClass('transition-colors')
  })

  it('renders exact hand-computed §5.3 valueUsd/valueMainCurrency for a known timestamp', () => {
    // Hand-computed per §5.3, using clean round numbers in place of a live
    // DefiLlama lookup (a unit test has no network access):
    //   priceUsdAtT(tx.token)     = 25   (picked round number, "at" this tx's timestamp)
    //   priceUsdAtT(mainCurrency) = 150  (picked round number, "at" this tx's timestamp)
    //   tx.amountToken            = 4
    //   tx.valueUsd               = amount * priceUsdAtT(token)        = 4 * 25  = 100
    //   tx.valueMainCurrency      = valueUsd / priceUsdAtT(mainCurrency) = 100 / 150 = 0.6666...
    const amount = 4
    const priceUsdAtTx = 25
    const valueUsd = amount * priceUsdAtTx
    const mainCurrencyPriceAtSameTimestamp = 150
    const valueMainCurrency = valueUsd / mainCurrencyPriceAtSameTimestamp

    const rows: ActivityRow[] = [
      {
        chain: 'solana',
        walletAddress: 'wallet1',
        txHash: 'abcdef1234567890',
        timestamp: 1_700_000_000, // known historical unix timestamp
        legs: [
          {
            direction: 'in',
            chain: 'solana',
            tokenId: 'token1',
            amount,
            symbol: 'TOK1',
            name: 'Token One',
            iconUrl: null,
            priceUsdAtTx,
            valueUsd,
            valueMainCurrency,
          },
        ],
      },
    ]

    render(<ActivityTable rows={rows} mainCurrency="SOL" />)

    // Rendered via the component's own formatLeg -> the real formatAmount/
    // formatMainCurrency helpers from src/lib/format, not a re-implementation.
    const amountText = formatAmount(amount, { maxFractionDigits: 4 })
    const valueText = formatMainCurrency(valueMainCurrency, 'SOL')
    expect(screen.getByText(`+${amountText} TOK1 (${valueText})`)).toBeInTheDocument()
  })
})
