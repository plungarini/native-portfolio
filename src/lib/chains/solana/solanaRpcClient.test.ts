import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SOLANA_RPC_HOSTS,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getParsedTransaction,
  getSignatures,
  getSolBalance,
  getTokenBalances,
  resetSolanaRpcHostRotation,
} from './solanaRpcClient'

const ADDRESS = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

function rpcResult(result: unknown) {
  return { jsonrpc: '2.0', id: 1, result }
}

/** Parses the JSON body of the given fetch mock call. */
function bodyOf(call: unknown[]) {
  const init = call[1] as RequestInit
  return JSON.parse(init.body as string) as {
    method: string
    params: unknown[]
  }
}

describe('solanaRpcClient', () => {
  beforeEach(() => {
    resetSolanaRpcHostRotation()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getSolBalance sends getBalance with the address and converts lamports to SOL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(rpcResult({ context: { slot: 1 }, value: 1_500_000_000 })),
      )
    vi.stubGlobal('fetch', fetchMock)

    const balance = await getSolBalance(ADDRESS)

    expect(balance).toBeCloseTo(1.5)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(SOLANA_RPC_HOSTS[0])
    expect(init.method).toBe('POST')
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [ADDRESS],
    })
  })

  it('getTokenBalances queries both token programs and flattens results', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          rpcResult({
            value: [
              {
                pubkey: 'TokenAccount1',
                account: {
                  data: {
                    parsed: {
                      info: {
                        mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
                        owner: ADDRESS,
                        tokenAmount: {
                          amount: '100000000',
                          decimals: 6,
                          uiAmount: 100,
                          uiAmountString: '100',
                        },
                      },
                      type: 'account',
                    },
                    program: 'spl-token',
                  },
                },
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          rpcResult({
            value: [
              {
                pubkey: 'TokenAccount2',
                account: {
                  data: {
                    parsed: {
                      info: {
                        mint: 'Token2022MintXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
                        owner: ADDRESS,
                        tokenAmount: {
                          amount: '2500',
                          decimals: 2,
                          uiAmount: 25,
                          uiAmountString: '25',
                        },
                      },
                      type: 'account',
                    },
                    program: 'spl-token-2022',
                  },
                },
              },
            ],
          }),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const balances = await getTokenBalances(ADDRESS)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(bodyOf(fetchMock.mock.calls[0]).params).toEqual([
      ADDRESS,
      { programId: TOKEN_PROGRAM_ID },
      { encoding: 'jsonParsed' },
    ])
    expect(bodyOf(fetchMock.mock.calls[1]).params).toEqual([
      ADDRESS,
      { programId: TOKEN_2022_PROGRAM_ID },
      { encoding: 'jsonParsed' },
    ])
    expect(balances).toEqual([
      { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', uiAmount: 100 },
      { mint: 'Token2022MintXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', uiAmount: 25 },
    ])
  })

  it('getSignatures sends getSignaturesForAddress with a limit and returns the signature list', async () => {
    const fixture = [
      {
        signature: 'sig1',
        slot: 100,
        err: null,
        memo: null,
        blockTime: 1700000000,
        confirmationStatus: 'finalized',
      },
    ]
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(rpcResult(fixture)))
    vi.stubGlobal('fetch', fetchMock)

    const signatures = await getSignatures(ADDRESS, 10)

    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({
      jsonrpc: '2.0',
      id: 1,
      method: 'getSignaturesForAddress',
      params: [ADDRESS, { limit: 10 }],
    })
    expect(signatures).toEqual(fixture)
  })

  it('getParsedTransaction requests jsonParsed encoding with maxSupportedTransactionVersion 0', async () => {
    const fixture = {
      slot: 1,
      blockTime: 1700000000,
      meta: {
        err: null,
        fee: 5000,
        preBalances: [1000],
        postBalances: [900],
      },
      transaction: {
        signatures: ['sig1'],
        message: {
          accountKeys: [{ pubkey: ADDRESS, signer: true, writable: true }],
        },
      },
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(rpcResult(fixture)))
    vi.stubGlobal('fetch', fetchMock)

    const tx = await getParsedTransaction('sig1')

    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [
        'sig1',
        { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
      ],
    })
    expect(tx).toEqual(fixture)
  })

  it('rotates to the next RPC host on a simulated network error', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(
        jsonResponse(rpcResult({ context: { slot: 1 }, value: 1_000_000_000 })),
      )
    vi.stubGlobal('fetch', fetchMock)

    const balance = await getSolBalance(ADDRESS)

    expect(balance).toBeCloseTo(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe(SOLANA_RPC_HOSTS[0])
    expect(fetchMock.mock.calls[1][0]).toBe(SOLANA_RPC_HOSTS[1])
  })

  it('rotates to the next RPC host on an HTTP 429', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(
        jsonResponse(rpcResult({ context: { slot: 1 }, value: 2_000_000_000 })),
      )
    vi.stubGlobal('fetch', fetchMock)

    const balance = await getSolBalance(ADDRESS)

    expect(balance).toBeCloseTo(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe(SOLANA_RPC_HOSTS[0])
    expect(fetchMock.mock.calls[1][0]).toBe(SOLANA_RPC_HOSTS[1])
  })

  it('throws once every configured host has failed', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getSolBalance(ADDRESS)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(SOLANA_RPC_HOSTS.length)
  })
})
