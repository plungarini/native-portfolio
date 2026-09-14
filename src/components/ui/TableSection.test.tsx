import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TableSection } from './TableSection'

describe('TableSection', () => {
  it('renders title and badge with children', () => {
    render(
      <TableSection title="Holdings" badge="12 assets">
        <p>row content</p>
      </TableSection>,
    )
    expect(screen.getByText('Holdings')).toBeInTheDocument()
    expect(screen.getByText('12 assets')).toBeInTheDocument()
    expect(screen.getByText('row content')).toBeInTheDocument()
  })

  it('omits the badge when none is given', () => {
    render(<TableSection title="Activity">content</TableSection>)
    expect(screen.getByText('Activity')).toBeInTheDocument()
  })
})
