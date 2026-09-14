import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { PnlCalendar } from './index'
import { demoPnlDays } from '../../lib/fixtures/demoData'
import type { PnlCalendarDay } from '../../hooks/usePnlCalendar'
import { formatSignedMainCurrency, formatUsd } from '../../lib/format/currency'

afterEach(cleanup)

describe('PnlCalendar', () => {
  it('opens on trigger click and closes on Escape', () => {
    render(<PnlCalendar days={demoPnlDays} mainCurrency="SOL" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Calendar'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders correct profit/loss day counts for the displayed month', () => {
    render(<PnlCalendar days={demoPnlDays} mainCurrency="SOL" />)
    fireEvent.click(screen.getByText('Calendar'))

    // The default displayed month is that of the most recent day in the
    // fixture (2026-09, only 4 days deep since demoPnlDays spans 35 days
    // from Aug 1).
    const latestMonth = demoPnlDays.reduce((a, b) => (a.date > b.date ? a : b)).date.slice(0, 7)
    const profitCount = demoPnlDays.filter(
      (d) => d.date.startsWith(latestMonth) && d.avgUsdPrice !== null && d.pnlUsd > 0,
    ).length
    const lossCount = demoPnlDays.filter(
      (d) => d.date.startsWith(latestMonth) && d.avgUsdPrice !== null && d.pnlUsd < 0,
    ).length

    const hasText = (text: string) => (_content: string, el: Element | null) =>
      el?.tagName === 'SPAN' && (el.textContent?.replace(/\s+/g, ' ').includes(text) ?? false)

    expect(screen.getByText(hasText(`Profit days ${profitCount} /`))).toBeInTheDocument()
    expect(screen.getByText(hasText(`Loss days ${lossCount} /`))).toBeInTheDocument()
  })

  it('renders no-data cells for days with null avgUsdPrice', () => {
    render(<PnlCalendar days={demoPnlDays} mainCurrency="SOL" />)
    fireEvent.click(screen.getByText('Calendar'))

    const dialog = screen.getByRole('dialog')
    // Default displayed month is 2026-09 (most recent day in the fixture).
    // Sept 2 (i=32) has avgUsdPrice: null -> no-data cell, so its
    // day-number label must not be rendered.
    expect(within(dialog).queryByText('2')).not.toBeInTheDocument()
    // A day with data, e.g. day 1, should render its number.
    expect(within(dialog).getByText('1')).toBeInTheDocument()
  })

  it('renders big/small text matching hand-computed §5.2 values for a scripted day', () => {
    // Hand-computed per §5.2: dailyPnlMainCurrency(D) = dailyPnlUsd(D) / mainCurrencyAvgUsd(D)
    // pnlUsd = 62, avgUsdPrice = 150 -> pnlMainCurrency = 62 / 150 = 0.41333...
    const pnlUsd = 62
    const avgUsdPrice = 150
    const pnlMainCurrency = pnlUsd / avgUsdPrice
    expect(pnlMainCurrency).toBeCloseTo(0.413333333, 9)

    const day: PnlCalendarDay = {
      date: '2026-09-05',
      pnlUsd,
      pnlMainCurrency,
      avgUsdPrice,
    }

    render(<PnlCalendar days={[day]} mainCurrency="SOL" />)
    fireEvent.click(screen.getByText('Calendar'))

    // Uses the real format helpers from src/lib/format, not a re-implementation.
    expect(screen.getByText(formatSignedMainCurrency(pnlMainCurrency, 'SOL'))).toBeInTheDocument()
    expect(screen.getByText(formatUsd(avgUsdPrice))).toBeInTheDocument()
  })
})
