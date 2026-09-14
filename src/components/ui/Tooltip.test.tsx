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
})
