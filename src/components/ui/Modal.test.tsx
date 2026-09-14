import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Modal } from './Modal'

afterEach(cleanup)

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Calendar">
        content
      </Modal>,
    )
    expect(screen.queryByText('Calendar')).not.toBeInTheDocument()
    expect(screen.queryByText('content')).not.toBeInTheDocument()
  })

  it('renders title and children when open', () => {
    render(
      <Modal open onClose={vi.fn()} title="Calendar">
        content
      </Modal>,
    )
    expect(screen.getByText('Calendar')).toBeInTheDocument()
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose}>
        content
      </Modal>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on backdrop click but not panel click', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Calendar">
        content
      </Modal>,
    )
    fireEvent.click(screen.getByText('content'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
