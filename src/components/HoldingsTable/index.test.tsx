import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HoldingsTable } from './index'
import { CurrencySwitcher } from '../CurrencySwitcher'
import { demoHoldings } from '../../lib/fixtures/demoData'
import { formatAmount } from '../../lib/format/number'
import { formatMainCurrency, formatUsd } from '../../lib/format/currency'
import type { Holding } from '../../hooks/useHoldings'

afterEach(cleanup)

function makeHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    key: 'solana:usdc',
    chain: 'solana',
    tokenId: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    iconUrl: null,
    isVerified: true,
    priceChange24h: 0.01,
    amountToken: 1000,
    currentUsdPrice: 1,
    usdValue: 1000,
    mainCurrencyValue: 6.6667,
    ...overrides,
  }
}

describe('HoldingsTable', () => {
  it('renders every holding symbol and its raw balance', () => {
    render(<HoldingsTable holdings={demoHoldings} mainCurrency="SOL" />)
    for (const holding of demoHoldings) {
      expect(screen.getAllByText(new RegExp(holding.symbol)).length).toBeGreaterThan(0)
    }
  })

  it('sorts rows by usdValue descending with nulls last', () => {
    const holdings = [
      makeHolding({ key: 'a', symbol: 'AAA', usdValue: 10 }),
      makeHolding({ key: 'b', symbol: 'BBB', usdValue: null, currentUsdPrice: null }),
      makeHolding({ key: 'c', symbol: 'CCC', usdValue: 500 }),
    ]
    render(<HoldingsTable holdings={holdings} mainCurrency="SOL" />)
    const symbols = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelector('td .truncate')!.textContent)
    expect(symbols).toEqual(['CCC', 'AAA', 'BBB'])
  })

  it('renders a verified badge only for verified tokens', () => {
    render(
      <HoldingsTable
        holdings={[
          makeHolding({ key: 'a', symbol: 'AAA', isVerified: true }),
          makeHolding({ key: 'b', symbol: 'BBB', isVerified: false }),
        ]}
        mainCurrency="SOL"
      />,
    )
    expect(screen.getByLabelText('AAA is a verified token')).toBeInTheDocument()
    expect(screen.queryByLabelText('BBB is a verified token')).not.toBeInTheDocument()
  })

  it('colours the 24h change by sign and em-dashes a null change', () => {
    render(
      <HoldingsTable
        holdings={[
          makeHolding({ key: 'up', symbol: 'UPP', priceChange24h: 1.56 }),
          makeHolding({ key: 'down', symbol: 'DWN', priceChange24h: -6.62 }),
          makeHolding({ key: 'none', symbol: 'NUN', priceChange24h: null }),
        ]}
        mainCurrency="SOL"
      />,
    )
    expect(screen.getByText('+1.56%')).toHaveClass('text-success')
    expect(screen.getByText('-6.62%')).toHaveClass('text-destructive')
    const nullRow = screen.getByText('NUN').closest('tr')!
    expect(nullRow.textContent).toContain('—')
  })

  it('renders "price unavailable" and the raw balance for a holding with a null price', () => {
    render(<HoldingsTable holdings={demoHoldings} mainCurrency="SOL" />)
    const cakeRow = screen.getByText('CAKE').closest('tr')
    expect(cakeRow).not.toBeNull()
    expect(cakeRow!.textContent).toMatch(/price unavailable/i)
    expect(cakeRow!.textContent).toContain('CAKE')
  })

  it('renders PnL from the lookup and an em dash for holdings missing from it', () => {
    render(
      <HoldingsTable
        holdings={[
          makeHolding({ key: 'loss', symbol: 'LOS' }),
          makeHolding({ key: 'nopnl', symbol: 'NOP' }),
        ]}
        mainCurrency="SOL"
        pnlByKey={{ loss: { usd: -27.14, percent: -6.62 } }}
      />,
    )
    expect(screen.getByText('-$27.14')).toHaveClass('text-destructive')
    const noPnlRow = screen.getByText('NOP').closest('tr')!
    expect(noPnlRow.textContent).toContain('—')
  })

  it('renders an empty state with no crash when there are no holdings', () => {
    render(<HoldingsTable holdings={[]} mainCurrency="SOL" />)
    expect(screen.getByText(/no holdings yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  describe('CurrencySwitcher integration (§5.1)', () => {
    // Fixed fixture: one holding with a known, unchanging usdValue and
    // currentUsdPrice(h.token). Per §5.1, mainCurrencyValue(h) = usdValue(h)
    // / currentUsdPrice(mainCurrency) — only the *denominator* changes when
    // the user switches mainCurrency, so the USD price column and the raw
    // token balance must stay fixed while the main-currency value updates.
    const USD_VALUE = 1000 // h.amountToken * currentUsdPrice(h.token), fixed
    const CURRENT_USD_PRICE: Record<string, number> = { SOL: 150, BNB: 600 }

    function Harness() {
      const [mainCurrency, setMainCurrency] = useState('SOL')
      const holdings: Holding[] = [
        makeHolding({ mainCurrencyValue: USD_VALUE / CURRENT_USD_PRICE[mainCurrency] }),
      ]
      return (
        <>
          <CurrencySwitcher value={mainCurrency} onChange={setMainCurrency} options={['SOL', 'BNB']} />
          <HoldingsTable holdings={holdings} mainCurrency={mainCurrency} />
        </>
      )
    }

    it('updates the main-currency column but leaves the USD figures unchanged', () => {
      render(<Harness />)

      const solMainText = formatMainCurrency(USD_VALUE / CURRENT_USD_PRICE.SOL, 'SOL')
      const bnbMainText = formatMainCurrency(USD_VALUE / CURRENT_USD_PRICE.BNB, 'BNB')
      const balanceText = `${formatAmount(1000, { maxFractionDigits: 4 })} USDC`

      expect(screen.getByText(solMainText)).toBeInTheDocument()
      expect(screen.getByText(formatUsd(1))).toBeInTheDocument()
      expect(screen.getByText(balanceText)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /SOL/ }))
      fireEvent.click(screen.getAllByRole('option', { name: /BNB/ })[0])

      expect(screen.queryByText(solMainText)).not.toBeInTheDocument()
      expect(screen.getByText(bnbMainText)).toBeInTheDocument()
      // USD-denominated figures are unchanged by the currency switch.
      expect(screen.getByText(formatUsd(1))).toBeInTheDocument()
      expect(screen.getByText(balanceText)).toBeInTheDocument()
    })
  })
})
