import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CurrencySwitcher } from './index'

afterEach(cleanup)

// The dropdown panel renders twice (desktop + mobile Modal sheet, per
// Popover) — jsdom doesn't apply CSS so both are query-visible; tests use
// getAllBy* and act on the first match, matching Popover's own test file.

describe('CurrencySwitcher', () => {
  it('shows the current value on the closed trigger', () => {
    render(<CurrencySwitcher value="USD" options={['USD', 'SOL']} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /USD/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /SOL/ })).not.toBeInTheDocument()
  })

  it('opens the dropdown listing every option, marking the current one selected', () => {
    render(<CurrencySwitcher value="USD" options={['USD', 'SOL', 'BNB']} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /USD/ }))

    const usdOptions = screen.getAllByRole('option', { name: /USD/ })
    const solOptions = screen.getAllByRole('option', { name: /SOL/ })
    expect(usdOptions[0]).toHaveAttribute('aria-selected', 'true')
    expect(solOptions[0]).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onChange and closes when an option is clicked', () => {
    const onChange = vi.fn()
    render(<CurrencySwitcher value="USD" options={['USD', 'SOL']} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /USD/ }))

    fireEvent.click(screen.getAllByRole('option', { name: /SOL/ })[0])
    expect(onChange).toHaveBeenCalledWith('SOL')
    expect(screen.queryByRole('option', { name: /SOL/ })).not.toBeInTheDocument()
  })

  it('closes on Escape', () => {
    render(<CurrencySwitcher value="USD" options={['USD', 'SOL']} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /USD/ }))
    expect(screen.getAllByRole('option', { name: /SOL/ }).length).toBeGreaterThan(0)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('option', { name: /SOL/ })).not.toBeInTheDocument()
  })
})
