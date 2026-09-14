import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useWallets } from './useWallets'
import { decode } from '../lib/encoding/accountCodec'
import { readTokenFromHash } from '../lib/encoding/urlState'
import { STORAGE_KEY } from '../lib/encoding/storagePersistence'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

beforeEach(() => {
  window.localStorage.clear()
  window.location.hash = ''
})

describe('useWallets', () => {
  it('starts from the empty onboarding state when no hash/localStorage token is present', async () => {
    const { result } = renderHook(() => useWallets(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.wallets).toEqual([])
    expect(result.current.mainCurrency).toBe('SOL')
  })

  it('addWallet appends a wallet and persists the re-encoded state to the URL hash + localStorage', async () => {
    const { result } = renderHook(() => useWallets(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.addWallet({
        chain: 'solana',
        address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        label: 'Main wallet',
      })
    })

    await waitFor(() => expect(result.current.wallets).toHaveLength(1))
    expect(result.current.wallets[0]).toEqual({
      chain: 'solana',
      address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
      label: 'Main wallet',
    })

    // Re-encoded state round-trips out of both the hash and localStorage.
    const hashToken = readTokenFromHash()
    expect(hashToken).not.toBeNull()
    expect(decode(hashToken!).wallets).toEqual(result.current.wallets)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(hashToken)
  })

  it('relabelWallet and removeWallet mutate the persisted wallet list', async () => {
    const { result } = renderHook(() => useWallets(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.addWallet({
        chain: 'bsc',
        address: '0x1111111111111111111111111111111111111111',
      })
    })
    await waitFor(() => expect(result.current.wallets).toHaveLength(1))

    act(() => {
      result.current.relabelWallet(
        'bsc',
        '0x1111111111111111111111111111111111111111',
        'Trading',
      )
    })
    await waitFor(() =>
      expect(result.current.wallets[0]?.label).toBe('Trading'),
    )

    act(() => {
      result.current.removeWallet(
        'bsc',
        '0x1111111111111111111111111111111111111111',
      )
    })
    await waitFor(() => expect(result.current.wallets).toHaveLength(0))

    const hashToken = readTokenFromHash()
    expect(decode(hashToken!).wallets).toEqual([])
  })

  it('setMainCurrency updates and persists the main currency', async () => {
    const { result } = renderHook(() => useWallets(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.setMainCurrency('USDC')
    })

    await waitFor(() => expect(result.current.mainCurrency).toBe('USDC'))
    const hashToken = readTokenFromHash()
    expect(decode(hashToken!).mainCurrency).toBe('USDC')
  })
})
