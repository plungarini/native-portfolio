import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Popover } from './Popover'

afterEach(cleanup)

// jsdom doesn't apply CSS, so Popover's `hidden`/`sm:hidden` responsive
// split (desktop panel vs. mobile Modal sheet) renders BOTH copies as
// query-visible here — tests assert against `getAllByText`/`getAllByRole`
// rather than assuming only one is present, the way a real browser would.

describe('Popover', () => {
  it('renders only the trigger when closed', () => {
    render(
      <Popover open={false} onClose={vi.fn()} trigger={<button>Open</button>}>
        panel content
      </Popover>,
    )
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.queryByText('panel content')).not.toBeInTheDocument()
  })

  it('renders the panel content (in both responsive variants) when open', () => {
    render(
      <Popover open onClose={vi.fn()} trigger={<button>Open</button>}>
        panel content
      </Popover>,
    )
    expect(screen.getAllByText('panel content').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the title in both the desktop panel and the mobile Modal', () => {
    render(
      <Popover open onClose={vi.fn()} trigger={<button>Open</button>} title="Add wallet">
        panel content
      </Popover>,
    )
    expect(screen.getAllByText('Add wallet').length).toBe(2)
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(
      <Popover open onClose={onClose} trigger={<button>Open</button>}>
        panel content
      </Popover>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose on a pointerdown outside the trigger/panel', () => {
    const onClose = vi.fn()
    render(
      <div>
        <button type="button">Outside</button>
        <Popover open onClose={onClose} trigger={<button>Open</button>}>
          panel content
        </Popover>
      </div>,
    )
    fireEvent.pointerDown(screen.getByText('Outside'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not call onClose for a pointerdown inside the desktop panel', () => {
    const onClose = vi.fn()
    render(
      <Popover open onClose={onClose} trigger={<button>Open</button>}>
        <button>Inside</button>
      </Popover>,
    )
    fireEvent.pointerDown(screen.getAllByText('Inside')[0])
    expect(onClose).not.toHaveBeenCalled()
  })
})
