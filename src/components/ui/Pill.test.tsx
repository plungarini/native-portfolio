import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Pill } from './Pill'

describe('Pill', () => {
  it('renders children with default variant classes', () => {
    render(<Pill>3 wallets</Pill>)
    expect(screen.getByText('3 wallets')).toHaveClass('bg-border/70')
  })

  it('applies the accent variant classes', () => {
    render(<Pill variant="accent">Active</Pill>)
    expect(screen.getByText('Active')).toHaveClass('bg-accent/20', 'text-accent')
  })
})
