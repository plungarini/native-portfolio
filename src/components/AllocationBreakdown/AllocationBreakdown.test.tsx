import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AllocationBreakdown } from './index'
import { demoHoldings } from '../../lib/fixtures/demoData'

afterEach(cleanup)

describe('AllocationBreakdown', () => {
  it('renders the token count caption', () => {
    render(<AllocationBreakdown holdings={demoHoldings} />)
    expect(screen.getByText(`${demoHoldings.length} tokens detected`)).toBeInTheDocument()
  })

  it('renders a legend chip per holding', () => {
    render(<AllocationBreakdown holdings={demoHoldings} />)
    for (const holding of demoHoldings) {
      expect(screen.getByText(holding.symbol)).toBeInTheDocument()
    }
  })

  it('shows price unavailable for holdings with no usdValue', () => {
    render(<AllocationBreakdown holdings={demoHoldings} />)
    expect(screen.getByText('price unavailable')).toBeInTheDocument()
  })

  it('handles an empty array without crashing', () => {
    render(<AllocationBreakdown holdings={[]} />)
    expect(screen.getByText('No tokens detected')).toBeInTheDocument()
  })
})
