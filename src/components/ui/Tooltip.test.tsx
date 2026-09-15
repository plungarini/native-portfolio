import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
  it('shows content on hover and hides on unhover', () => {
    render(
      <Tooltip content="0x1234...abcd">
        <button>0x12…cd</button>
      </Tooltip>,
    )
    const trigger = screen.getByRole('button')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.mouseEnter(trigger)
    expect(screen.getByRole('tooltip')).toHaveTextContent('0x1234...abcd')
    expect(trigger).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id)

    fireEvent.mouseLeave(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows content on focus and hides on blur', () => {
    render(
      <Tooltip content="Full amount">
        <button>1.58K</button>
      </Tooltip>,
    )
    const trigger = screen.getByRole('button', { name: '1.58K' })

    fireEvent.focus(trigger)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Full amount')

    fireEvent.blur(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('fades and rises in via transition classes instead of appearing instantly', () => {
    const { getByRole, container } = render(
      <Tooltip content="Hi">
        <button>fade trigger</button>
      </Tooltip>,
    )
    const trigger = getByRole('button', { name: 'fade trigger' })
    const tooltip = container.querySelector('[role="tooltip"]') as HTMLElement
    expect(tooltip).toHaveClass('transition-[opacity,transform]', 'duration-150', 'opacity-0', 'translate-y-1')

    fireEvent.mouseEnter(trigger)
    expect(tooltip).toHaveClass('opacity-100', 'translate-y-0')
    expect(tooltip).not.toHaveClass('opacity-0')

    fireEvent.mouseLeave(trigger)
    expect(tooltip).toHaveClass('opacity-0', 'translate-y-1')
  })
})
