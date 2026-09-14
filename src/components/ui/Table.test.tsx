import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './Table'

describe('Table', () => {
  it('renders a semantic table with header and body rows', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>SOL</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Asset')).toBeInTheDocument()
    expect(screen.getByText('SOL')).toBeInTheDocument()
  })

  it('supports className passthrough for column-width overrides', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="w-28">Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    expect(screen.getByText('Cell')).toHaveClass('w-28')
  })
})
