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
})
