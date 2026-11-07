import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkHealth } from './api'

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
