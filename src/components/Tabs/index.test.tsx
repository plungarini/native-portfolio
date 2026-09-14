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
})
