import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the tabs and a holdings row', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: 'Holdings' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Activity' })).toBeInTheDocument()
    expect(screen.getAllByText('SOL').length).toBeGreaterThan(0)
  })
})
