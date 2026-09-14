import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HoldingsTable } from './index'
import { demoHoldings } from '../../lib/fixtures/demoData'

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
})
