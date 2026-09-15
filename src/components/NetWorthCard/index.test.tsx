import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NetWorthCard } from './index'

afterEach(cleanup)

const series = [1200, 1250, 1180, 1310, 1426.91]

describe('NetWorthCard', () => {
  it('renders the total, main-currency equivalent and range selector', () => {
    render(
      <NetWorthCard
        totalUsd={1426.91}
        mainCurrencyTotal={13.92}
        mainCurrency="SOL"
        changeUsd={-0.44}
        changePercent={-0.03}
        series={series}
        ranges={['1D', '1W', '3M']}
        activeRange="3M"
      />,
    )

    expect(screen.getByText('$1,426.91')).toBeInTheDocument()
    expect(screen.getByText('13.92 SOL')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3M' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '1D' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(/since yesterday/)).toBeInTheDocument()
  })

  it('calls onRangeChange with the clicked range', () => {
    const onRangeChange = vi.fn()
    render(
      <NetWorthCard
        totalUsd={100}
        mainCurrencyTotal={1}
        mainCurrency="SOL"
        changeUsd={1}
        changePercent={1}
        ranges={['1D', '1W']}
        activeRange="1D"
        onRangeChange={onRangeChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '1W' }))
    expect(onRangeChange).toHaveBeenCalledWith('1W')
  })

  it('colours a positive change with the success token', () => {
    render(
      <NetWorthCard
        totalUsd={1000}
        mainCurrencyTotal={10}
        mainCurrency="SOL"
        changeUsd={12.5}
        changePercent={1.25}
        series={[900, 1000]}
      />,
    )

    const change = screen.getByText('+$12.50 (+1.25%)')
    expect(change).toHaveClass('text-success')
    expect(change).not.toHaveClass('text-destructive')
    expect(screen.getByTestId('networth-sparkline')).toHaveClass('text-success')
  })

  it('colours a negative change and a falling sparkline with the destructive token', () => {
    render(
      <NetWorthCard
        totalUsd={1000}
        mainCurrencyTotal={10}
        mainCurrency="SOL"
        changeUsd={-12.5}
        changePercent={-1.25}
        series={[1200, 1000]}
      />,
    )

    const change = screen.getByText('-$12.50 (-1.25%)')
    expect(change).toHaveClass('text-destructive')
    expect(screen.getByTestId('networth-sparkline')).toHaveClass('text-destructive')
  })

  it('renders an empty spacer when the series has fewer than two points', () => {
    render(
      <NetWorthCard
        totalUsd={1000}
        mainCurrencyTotal={10}
        mainCurrency="SOL"
        changeUsd={0}
        changePercent={0}
        series={[1000]}
      />,
    )

    expect(screen.queryByTestId('networth-sparkline')).not.toBeInTheDocument()
    expect(screen.getByTestId('networth-sparkline-empty')).toBeInTheDocument()
  })

  it('renders the missing-data path without crashing', () => {
    render(
      <NetWorthCard
        totalUsd={null}
        mainCurrencyTotal={null}
        mainCurrency="SOL"
        changeUsd={null}
        changePercent={null}
      />,
    )

    expect(screen.getAllByText('price unavailable')).toHaveLength(2)
    expect(screen.getByText('No change data')).toBeInTheDocument()
    expect(screen.getByTestId('networth-sparkline-empty')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Range' })).not.toBeInTheDocument()
  })

  it('draws a flat series down the middle without producing NaN coordinates', () => {
    const { container } = render(
      <NetWorthCard
        totalUsd={1000}
        mainCurrencyTotal={10}
        mainCurrency="SOL"
        changeUsd={0}
        changePercent={0}
        series={[1000, 1000, 1000]}
      />,
    )

    const paths = container.querySelectorAll('[data-testid="networth-sparkline"] path')
    expect(paths.length).toBe(2)
    paths.forEach((path) => expect(path.getAttribute('d')).not.toMatch(/NaN/))
  })
})
