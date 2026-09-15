import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Tabs } from './index'

afterEach(cleanup)

const tabs = [
  { key: 'holdings', label: 'Holdings' },
  { key: 'activity', label: 'Activity' },
]

describe('Tabs', () => {
  it('renders all tab labels', () => {
    render(<Tabs tabs={tabs} activeKey="holdings" onChange={vi.fn()} />)
    expect(screen.getByText('Holdings')).toBeInTheDocument()
    expect(screen.getByText('Activity')).toBeInTheDocument()
  })

  it('marks the active tab as selected', () => {
    render(<Tabs tabs={tabs} activeKey="activity" onChange={vi.fn()} />)
    expect(screen.getByRole('tab', { name: 'Activity' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Holdings' })).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onChange with the clicked tab key', async () => {
    const onChange = vi.fn()
    render(<Tabs tabs={tabs} activeKey="holdings" onChange={onChange} />)
    fireEvent.click(screen.getByText('Activity'))
    expect(onChange).toHaveBeenCalledWith('activity')
  })

  it('renders the underline indicator only inside the active tab', () => {
    render(<Tabs tabs={tabs} activeKey="holdings" onChange={vi.fn()} />)
    const indicator = screen.getByTestId('tab-indicator-holdings')
    expect(indicator).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Holdings' })).toContainElement(indicator)
    expect(screen.queryByTestId('tab-indicator-activity')).not.toBeInTheDocument()
  })

  it('exposes a tablist and renders without crashing when there are no tabs', () => {
    render(<Tabs tabs={[]} activeKey="" onChange={vi.fn()} />)
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })
})
