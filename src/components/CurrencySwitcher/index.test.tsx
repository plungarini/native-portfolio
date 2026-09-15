import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CurrencySwitcher } from './index'

afterEach(cleanup)

describe('CurrencySwitcher', () => {
  it('marks the current value as pressed', () => {
    render(<CurrencySwitcher value="USD" options={['USD', 'SOL']} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'USD' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'SOL' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with the clicked symbol', async () => {
    const onChange = vi.fn()
    render(<CurrencySwitcher value="USD" options={['USD', 'SOL']} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'SOL' }))
    expect(onChange).toHaveBeenCalledWith('SOL')
  })

  it('gives the active pill a distinct visual treatment from inactive pills', () => {
    render(<CurrencySwitcher value="USD" options={['USD', 'SOL']} onChange={vi.fn()} />)
    const activePill = screen.getByText('USD')
    const inactivePill = screen.getByText('SOL')
    expect(activePill.className).toContain('bg-accent/20')
    expect(inactivePill.className).toContain('bg-muted')
    expect(activePill.className).not.toBe(inactivePill.className)
  })

  it('applies a transition to the pill colour swap', () => {
    render(<CurrencySwitcher value="USD" options={['USD', 'SOL']} onChange={vi.fn()} />)
    expect(screen.getByText('USD').className).toContain('transition-colors')
  })

  it('shows a visible focus-visible ring on the trigger button', () => {
    render(<CurrencySwitcher value="USD" options={['USD', 'SOL']} onChange={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'USD' })
    expect(button.className).toContain('focus-visible:ring-2')
    expect(button.className).toContain('focus-visible:ring-accent/50')
  })

  it('gives the trigger button tactile press feedback', () => {
    render(<CurrencySwitcher value="USD" options={['USD', 'SOL']} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'USD' }).className).toContain('active:scale-[0.97]')
  })
})
