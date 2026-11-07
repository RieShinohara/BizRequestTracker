import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkHealth, fetchRequests, fetchSummary } from './api'

function mockFetch(implementation: () => Promise<unknown>) {
  vi.stubGlobal('fetch', vi.fn(implementation))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('checkHealth', () => {
  it('API が ok を返したら、true', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ status: 'ok' }) }))
    expect(await checkHealth()).toBe(true)
    expect(fetch).toHaveBeenCalledWith('/health')
  })

  it('API が ok 以外を返したら、false', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ status: 'ng' }) }))
    expect(await checkHealth()).toBe(false)
  })

  it('API がエラーの番号（500 など）を返したら、false', async () => {
    mockFetch(async () => ({ ok: false, json: async () => ({}) }))
    expect(await checkHealth()).toBe(false)
  })

  it('API につながらなかったら（止まっている）、false', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await checkHealth()).toBe(false)
  })
})

describe('fetchRequests', () => {
  it('条件なしなら /api/requests を呼び、配列を返す', async () => {
    mockFetch(async () => ({ ok: true, json: async () => [{ id: 1 }] }))
    expect(await fetchRequests()).toEqual([{ id: 1 }])
    expect(fetch).toHaveBeenCalledWith('/api/requests')
  })

  it('アーカイブも含めるときは、include_archived=true を付ける', async () => {
    mockFetch(async () => ({ ok: true, json: async () => [] }))
    await fetchRequests({ includeArchived: true })
    expect(fetch).toHaveBeenCalledWith('/api/requests?include_archived=true')
  })

  it('API がエラーの番号を返したら、例外を投げる', async () => {
    mockFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    await expect(fetchRequests()).rejects.toThrow('500')
  })

  it('API につながらなかったら、例外を投げる', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(fetchRequests()).rejects.toThrow()
  })
})

describe('fetchSummary', () => {
  it('/api/summary を呼び、件数を返す', async () => {
    const body = { status_counts: { 未着手: 1 }, urgent_count: 2 }
    mockFetch(async () => ({ ok: true, json: async () => body }))
    expect(await fetchSummary()).toEqual(body)
    expect(fetch).toHaveBeenCalledWith('/api/summary')
  })

  it('API がエラーの番号を返したら、例外を投げる', async () => {
    mockFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    await expect(fetchSummary()).rejects.toThrow('503')
  })
})
