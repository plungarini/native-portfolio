import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SummaryChips, type SummaryChip } from './index'

const chips: SummaryChip[] = [
  { key: 'holdings', label: 'Holdings', value: '$904.24' },
  { key: 'solana', label: 'Solana', value: '$699.24', icon: <span data-testid="sol-icon" /> },
  { key: 'bsc', label: 'BSC', value: '$205.00', selected: true },
]

describe('SummaryChips', () => {
  it('renders every chip label, value and icon', () => {
    render(<SummaryChips chips={chips} />)
    expect(screen.getByText('Holdings')).toBeInTheDocument()
    expect(screen.getByText('$904.24')).toBeInTheDocument()
    expect(screen.getByText('Solana')).toBeInTheDocument()
    expect(screen.getByText('BSC')).toBeInTheDocument()
    expect(screen.getByTestId('sol-icon')).toBeInTheDocument()
  })

  it('renders nothing when there are no chips', () => {
    const { container } = render(<SummaryChips chips={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders non-interactive chips when onSelect is omitted', () => {
    render(<SummaryChips chips={chips} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('renders buttons and reports the selected key when onSelect is provided', () => {
    const onSelect = vi.fn()
    render(<SummaryChips chips={chips} onSelect={onSelect} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)

    fireEvent.click(buttons[1])
    expect(onSelect).toHaveBeenCalledWith('solana')
  })

  it('marks the selected chip with the accent ring', () => {
    const onSelect = vi.fn()
    render(<SummaryChips chips={chips} onSelect={onSelect} />)

    const [holdings, , bsc] = screen.getAllByRole('button')
    expect(bsc).toHaveClass('ring-1', 'ring-accent/40')
    expect(bsc).toHaveAttribute('aria-pressed', 'true')
    expect(holdings).not.toHaveClass('ring-accent/40')
    expect(holdings).toHaveAttribute('aria-pressed', 'false')
  })
})
