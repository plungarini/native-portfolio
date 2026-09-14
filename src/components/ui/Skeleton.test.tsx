import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('renders a pulsing block with default rounding', () => {
    const { container } = render(<Skeleton className="h-4 w-20" />)
    const el = container.firstElementChild
    expect(el).toHaveClass('animate-pulse', 'bg-muted', 'rounded-md', 'h-4', 'w-20')
  })

  it('applies a custom rounded override', () => {
    const { container } = render(<Skeleton rounded="rounded-full" />)
    expect(container.firstElementChild).toHaveClass('rounded-full')
  })
})
