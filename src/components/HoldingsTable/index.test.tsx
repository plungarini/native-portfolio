import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HoldingsTable } from './index'
import { CurrencySwitcher } from '../CurrencySwitcher'
import { demoHoldings } from '../../lib/fixtures/demoData'
import { formatAmount } from '../../lib/format/number'
import { formatUsd } from '../../lib/format/currency'
import type { Holding } from '../../hooks/useHoldings'

afterEach(cleanup)

describe('HoldingsTable', () => {
  it('renders every holding symbol and amount', () => {
    render(<HoldingsTable holdings={demoHoldings} mainCurrency="SOL" />)
    for (const holding of demoHoldings) {
      expect(screen.getAllByText(new RegExp(holding.symbol)).length).toBeGreaterThan(0)
    }
  })

  it('renders "price unavailable" for a holding with a null price', () => {
    render(<HoldingsTable holdings={demoHoldings} mainCurrency="SOL" />)
    const cakeRow = screen.getByText('CAKE').closest('tr')
    expect(cakeRow).not.toBeNull()
    expect(cakeRow!.textContent).toMatch(/price unavailable/i)
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
    // the user switches mainCurrency, so the USD parenthetical must stay
    // fixed while the main-currency column updates.
    const USD_VALUE = 1000 // h.amountToken * currentUsdPrice(h.token), fixed
    const CURRENT_USD_PRICE: Record<string, number> = { SOL: 150, BNB: 600 }

    function Harness() {
      const [mainCurrency, setMainCurrency] = useState('SOL')
      const holdings: Holding[] = [
        {
          key: 'solana:usdc',
          chain: 'solana',
          tokenId: 'usdc',
          symbol: 'USDC',
          amountToken: 1000,
          currentUsdPrice: 1,
          usdValue: USD_VALUE,
          mainCurrencyValue: USD_VALUE / CURRENT_USD_PRICE[mainCurrency],
        },
      ]
      return (
        <>
          <CurrencySwitcher value={mainCurrency} onChange={setMainCurrency} options={['SOL', 'BNB']} />
          <HoldingsTable holdings={holdings} mainCurrency={mainCurrency} />
        </>
      )
    }

    it('updates the main-currency column but leaves the USD parenthetical unchanged', () => {
      render(<Harness />)

      const expectedUsdText = `(${formatUsd(USD_VALUE)})`
      const solMainText = `${formatAmount(USD_VALUE / CURRENT_USD_PRICE.SOL, { maxFractionDigits: 4 })} SOL`
      const bnbMainText = `${formatAmount(USD_VALUE / CURRENT_USD_PRICE.BNB, { maxFractionDigits: 4 })} BNB`

      expect(screen.getByText(solMainText)).toBeInTheDocument()
      expect(screen.getByText(expectedUsdText)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'BNB' }))

      expect(screen.queryByText(solMainText)).not.toBeInTheDocument()
      expect(screen.getByText(bnbMainText)).toBeInTheDocument()
      // USD-in-parens figure is unchanged by the currency switch.
      expect(screen.getByText(expectedUsdText)).toBeInTheDocument()
    })
  })
})
