import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Failed</Badge>)
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('applies the success variant classes', () => {
    render(<Badge variant="success">Confirmed</Badge>)
    expect(screen.getByText('Confirmed')).toHaveClass('bg-success/10', 'text-success')
  })

  it('applies the destructive variant classes', () => {
    render(<Badge variant="destructive">Spam</Badge>)
    expect(screen.getByText('Spam')).toHaveClass('bg-destructive/10', 'text-destructive')
  })
})
