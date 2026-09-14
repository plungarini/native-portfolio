import { afterEach, describe, expect, it, vi } from 'vitest'
import { bscRpcHosts } from '../../../config/chains'

// Independently hand-derived (Python, ABI spec by hand — see task notes)
// ground-truth fixtures for a 2-call Multicall3 `aggregate3` round trip.
const OWNER = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const TARGET_A = '0x1111111111111111111111111111111111111111'
const TARGET_B = '0x2222222222222222222222222222222222222222'

const ENCODE_FIXTURE =
  '0x82ad56cb0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000100000000000000000000000000111111111111111111111111111111111111111100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002470a08231000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa00000000000000000000000000000000000000000000000000000000000000000000000000000000222222222222222222222222222222222222222200000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002470a08231000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa00000000000000000000000000000000000000000000000000000000'

const DECODE_FIXTURE =
  '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000001e2400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000'

const BALANCE1_HEX =
  '0x000000000000000000000000000000000000000000000000000000000001e240'
const BALANCE2_HEX =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

async function freshModule() {
  vi.resetModules()
  return import('./bscRpcClient')
}

describe('ABI helpers', () => {
  it('encodes aggregate3 calldata correctly for a 2-call balance batch fixture', async () => {
    const { encodeAggregate3Calldata, encodeBalanceOfCalldata } =
      await freshModule()
    const calls = [
      {
        target: TARGET_A,
        allowFailure: true,
        callData: encodeBalanceOfCalldata(OWNER),
      },
      {
        target: TARGET_B,
        allowFailure: true,
        callData: encodeBalanceOfCalldata(OWNER),
      },
    ]
    expect(encodeAggregate3Calldata(calls)).toBe(ENCODE_FIXTURE)
  })

  it('decodes an aggregate3 Result[] fixture into success/returnData pairs', async () => {
    const { decodeAggregate3Result } = await freshModule()
    expect(decodeAggregate3Result(DECODE_FIXTURE)).toEqual([
      { success: true, returnData: BALANCE1_HEX },
      { success: true, returnData: BALANCE2_HEX },
    ])
  })

  it('scales a raw balance down by the token decimals', async () => {
    const { scaleRawAmount, hexToBigInt } = await freshModule()
    expect(scaleRawAmount(hexToBigInt(BALANCE1_HEX), 18)).toBeCloseTo(
      123456e-18,
      30,
    )
    expect(scaleRawAmount(hexToBigInt(BALANCE2_HEX), 18)).toBe(0)
    expect(scaleRawAmount(100000000n, 8)).toBe(1)
  })
})

function jsonRpcResponse(result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('getTokenBalances (Multicall3 batching)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends one batched eth_call and decodes/scales each token balance', async () => {
    const {
      getTokenBalances,
      encodeAggregate3Calldata,
      encodeBalanceOfCalldata,
    } = await freshModule()
    const fetchMock = vi.fn().mockResolvedValue(jsonRpcResponse(DECODE_FIXTURE))
    vi.stubGlobal('fetch', fetchMock)

    const tokenList = [
      { symbol: 'A', name: 'Token A', address: TARGET_A, decimals: 18 },
      { symbol: 'B', name: 'Token B', address: TARGET_B, decimals: 6 },
    ]

    const balances = await getTokenBalances(OWNER, tokenList)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.method).toBe('eth_call')
    expect(body.params[0].to).toBe('0xcA11bde05977b3631167028862bE2a173976CA11')
    expect(body.params[0].data).toBe(
      encodeAggregate3Calldata([
        {
          target: TARGET_A,
          allowFailure: true,
          callData: encodeBalanceOfCalldata(OWNER),
        },
        {
          target: TARGET_B,
          allowFailure: true,
          callData: encodeBalanceOfCalldata(OWNER),
        },
      ]),
    )

    expect(balances).toEqual([
      { token: tokenList[0], amountRaw: 123456n, amount: 123456e-18 },
      { token: tokenList[1], amountRaw: 0n, amount: 0 },
    ])
  })

  it('returns an empty array without calling fetch for an empty token list', async () => {
    const { getTokenBalances } = await freshModule()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await getTokenBalances(OWNER, [])).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('getBnbBalance', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('converts the eth_getBalance wei result into BNB', async () => {
    const { getBnbBalance } = await freshModule()
    // 1.5 BNB in wei, hex-encoded.
    const wei = 1_500_000_000_000_000_000n
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonRpcResponse('0x' + wei.toString(16)))
    vi.stubGlobal('fetch', fetchMock)

    const balance = await getBnbBalance(
      '0xC0FFEE0000000000000000000000000000C0FE',
    )
    expect(balance).toBeCloseTo(1.5, 12)

    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.method).toBe('eth_getBalance')
    expect(body.params).toEqual([
      '0xC0FFEE0000000000000000000000000000C0FE',
      'latest',
    ])
  })
})

describe('getTokenDecimals', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches decimals() once and caches the result for subsequent calls', async () => {
    const { getTokenDecimals } = await freshModule()
    const fetchMock = vi.fn().mockResolvedValue(jsonRpcResponse('0x12')) // 18
    vi.stubGlobal('fetch', fetchMock)

    expect(await getTokenDecimals(TARGET_A)).toBe(18)
    expect(await getTokenDecimals(TARGET_A)).toBe(18)
    expect(await getTokenDecimals(TARGET_A.toUpperCase())).toBe(18)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.method).toBe('eth_call')
    expect(body.params[0]).toEqual({ to: TARGET_A, data: '0x313ce567' })
  })
})

describe('getTransferLogs', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds correct eth_getLogs params (topics, address, block range) and scales the parsed logs', async () => {
    const { getTransferLogs, addressToTopic } = await freshModule()
    const wallet = '0x' + '0'.repeat(38) + 'aa'
    const counterparty = '0x' + '0'.repeat(38) + 'bb'
    const walletTopic = addressToTopic(wallet)
    const TRANSFER_TOPIC =
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

    const outgoingLog = {
      transactionHash: '0xout1',
      blockNumber: '0x64', // 100
      logIndex: '0x0',
      address: TARGET_A,
      topics: [
        TRANSFER_TOPIC,
        walletTopic,
        '0x' + counterparty.slice(2).toLowerCase().padStart(64, '0'),
      ],
      data: '0x' + (2n * 10n ** 18n).toString(16).padStart(64, '0'),
    }
    const incomingLog = {
      transactionHash: '0xin1',
      blockNumber: '0x65', // 101
      logIndex: '0x1',
      address: TARGET_A,
      topics: [
        TRANSFER_TOPIC,
        '0x' + counterparty.slice(2).toLowerCase().padStart(64, '0'),
        walletTopic,
      ],
      data: '0x' + (3n * 10n ** 18n).toString(16).padStart(64, '0'),
    }

    const fetchMock = vi
      .fn()
      .mockImplementation(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string)
        if (body.method === 'eth_call') {
          return jsonRpcResponse('0x12') // decimals = 18
        }
        // eth_getLogs
        const [params] = body.params
        const isOutgoing = params.topics[1] !== null
        return jsonRpcResponse(isOutgoing ? [outgoingLog] : [incomingLog])
      })
    vi.stubGlobal('fetch', fetchMock)

    const entries = await getTransferLogs(wallet, TARGET_A, 50, 150)

    // decimals call + outgoing eth_getLogs + incoming eth_getLogs
    expect(fetchMock).toHaveBeenCalledTimes(3)

    const logCalls = fetchMock.mock.calls
      .map(([, init]) => JSON.parse((init as RequestInit).body as string))
      .filter((body) => body.method === 'eth_getLogs')
    expect(logCalls).toHaveLength(2)

    for (const call of logCalls) {
      const [params] = call.params
      expect(params.address).toBe(TARGET_A)
      expect(params.fromBlock).toBe('0x32') // 50
      expect(params.toBlock).toBe('0x96') // 150
      expect(params.topics[0]).toBe(TRANSFER_TOPIC)
    }
    const outgoingCall = logCalls.find((c) => c.params[0].topics[1] !== null)
    const incomingCall = logCalls.find((c) => c.params[0].topics[2] !== null)
    expect(outgoingCall.params[0].topics).toEqual([
      TRANSFER_TOPIC,
      walletTopic,
      null,
    ])
    expect(incomingCall.params[0].topics).toEqual([
      TRANSFER_TOPIC,
      null,
      walletTopic,
    ])

    expect(entries).toEqual([
      {
        txHash: '0xin1',
        blockNumber: 101,
        logIndex: 1,
        tokenAddress: TARGET_A.toLowerCase(),
        from: counterparty.toLowerCase(),
        to: wallet.toLowerCase(),
        amountRaw: 3n * 10n ** 18n,
        amount: 3,
      },
      {
        txHash: '0xout1',
        blockNumber: 100,
        logIndex: 0,
        tokenAddress: TARGET_A.toLowerCase(),
        from: wallet.toLowerCase(),
        to: counterparty.toLowerCase(),
        amountRaw: 2n * 10n ** 18n,
        amount: 2,
      },
    ])
  })
})

describe('RPC host fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-robins to the next host on a simulated network error', async () => {
    const { getBnbBalance } = await freshModule()
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === bscRpcHosts[0]) {
        throw new Error('network error')
      }
      return jsonRpcResponse('0x0')
    })
    vi.stubGlobal('fetch', fetchMock)

    const balance = await getBnbBalance(
      '0xC0FFEE0000000000000000000000000000C0FE',
    )
    expect(balance).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe(bscRpcHosts[0])
    expect(fetchMock.mock.calls[1][0]).toBe(bscRpcHosts[1])
  })

  it('round-robins to the next host on a simulated HTTP 429', async () => {
    const { getBnbBalance } = await freshModule()
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === bscRpcHosts[0]) {
        return new Response('rate limited', { status: 429 })
      }
      return jsonRpcResponse('0x0')
    })
    vi.stubGlobal('fetch', fetchMock)

    const balance = await getBnbBalance(
      '0xC0FFEE0000000000000000000000000000C0FE',
    )
    expect(balance).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe(bscRpcHosts[0])
    expect(fetchMock.mock.calls[1][0]).toBe(bscRpcHosts[1])
  })

  it('throws once every host has failed', async () => {
    const { getBnbBalance } = await freshModule()
    const fetchMock = vi.fn().mockRejectedValue(new Error('down'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      getBnbBalance('0xC0FFEE0000000000000000000000000000C0FE'),
    ).rejects.toThrow(/All BSC RPC hosts failed/)
    expect(fetchMock).toHaveBeenCalledTimes(bscRpcHosts.length)
  })
})
