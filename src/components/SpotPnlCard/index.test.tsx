import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SpotPnlCard } from './index'
import type { PnlCalendarDay } from '../../hooks/usePnlCalendar'

afterEach(cleanup)

function day(
  date: string,
  pnlUsd: number,
  pnlMainCurrency: number | null = pnlUsd / 100,
): PnlCalendarDay {
  return { date, pnlUsd, pnlMainCurrency, avgUsdPrice: pnlMainCurrency === null ? null : 100 }
}

const days: PnlCalendarDay[] = [
  day('2026-09-01', -20),
  day('2026-09-02', 0),
  day('2026-09-03', 120.5),
  day('2026-09-04', 10),
  day('2026-09-05', 5),
]

describe('SpotPnlCard', () => {
  it('renders the signed total, best day and streak from the days array', () => {
    render(<SpotPnlCard days={days} mainCurrency="SOL" />)

    expect(screen.getByText('Spot PnL')).toBeInTheDocument()
    expect(screen.getByText('Sep')).toBeInTheDocument()
    // -20 + 0 + 120.50 + 10 + 5 = 115.50 USD -> 1.155 SOL (pnlMainCurrency = pnlUsd/100)
    expect(screen.getByText('+1.155 SOL')).toHaveClass('text-success')
    expect(screen.getByText('+$115.50')).toBeInTheDocument()
    // Best day (Sep 3, 120.50 USD) leads with main-currency too.
    expect(screen.getByText('+1.205 SOL')).toBeInTheDocument()
    // Sep 5, 4 and 3 are all > 0; Sep 2 is 0 and breaks the streak.
    expect(screen.getByText('3 days')).toBeInTheDocument()
    expect(screen.getByText('Sep 1-5')).toBeInTheDocument()
  })

  it('colours a negative total with the destructive token', () => {
    render(
      <SpotPnlCard days={[day('2026-09-01', -50), day('2026-09-02', -10)]} mainCurrency="SOL" />,
    )

    const total = screen.getByText('-0.6 SOL')
    expect(total).toHaveClass('text-destructive')
    expect(total).not.toHaveClass('text-success')
    expect(screen.getByText('-$60.00')).toBeInTheDocument()
    expect(screen.getByText('0 days')).toBeInTheDocument()
  })

  it('tints each dot by sign and highlights the most recent day', () => {
    render(<SpotPnlCard days={days} mainCurrency="SOL" />)

    expect(screen.getByTestId('pnl-dot-2026-09-01').className).toContain('bg-destructive/60')
    expect(screen.getByTestId('pnl-dot-2026-09-02').className).toContain('bg-muted')
    expect(screen.getByTestId('pnl-dot-2026-09-03').className).toContain('bg-success/60')
    // Sep 5 is the latest day with data -> brighter, un-dimmed tint.
    expect(screen.getByTestId('pnl-dot-2026-09-05').className).toContain('bg-success')
    expect(screen.getByTestId('pnl-dot-2026-09-05').className).not.toContain('bg-success/60')
    // September has 30 days; days past the period still render as muted dots.
    expect(screen.getByTestId('pnl-dot-2026-09-30').className).toContain('bg-muted')
  })

  it('renders an empty period without crashing', () => {
    render(<SpotPnlCard days={[]} mainCurrency="SOL" periodLabel="Sep" />)

    expect(screen.getByText('+$0.00')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('0 days')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0)
  })

  it('omits the main-currency line when no day could be converted', () => {
    render(<SpotPnlCard days={[day('2026-09-01', 25, null)]} mainCurrency="SOL" />)

    expect(screen.getAllByText('+$25.00').length).toBeGreaterThan(0)
    expect(screen.queryByText(/SOL/)).not.toBeInTheDocument()
  })

  it('leads with the main currency and does not render a fake period-switcher chevron', () => {
    const { container } = render(<SpotPnlCard days={days} mainCurrency="SOL" />)
    expect(screen.getByText('+1.155 SOL')).toHaveClass('text-3xl')
    expect(screen.getByText('+$115.50')).toHaveClass('text-xs')
    // Only the functional "PnL Calendar" caret should render — no decorative
    // chevron with no handler next to the period label.
    expect(container.querySelectorAll('svg').length).toBe(2) // CalendarBlank + PnL Calendar's CaretRight
  })

  it('renders a single figure with no redundant USD line when mainCurrency is USD', () => {
    render(<SpotPnlCard days={days} mainCurrency="USD" />)
    expect(screen.getAllByText('+$115.50')).toHaveLength(1)
  })

  it('renders the action slot and calls onOpenCalendar', () => {
    const onOpenCalendar = vi.fn()
    render(
      <SpotPnlCard
        days={days}
        mainCurrency="SOL"
        onOpenCalendar={onOpenCalendar}
        action={<button type="button">Share</button>}
      />,
    )

    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /PnL Calendar/ }))
    expect(onOpenCalendar).toHaveBeenCalledTimes(1)
  })
})
