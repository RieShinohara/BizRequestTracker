import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildRequestsUrl,
  checkHealth,
  fetchCategories,
  fetchConfirmTargets,
  createRequest,
  deleteRequest,
  fetchRequest,
  fetchTemplateItems,
  fetchRequesters,
  fetchRequests,
  createRequester,
  updateRequesterExtension,
  fetchSummary,
  statusChangeToPatch,
  updateRequest,
} from './api'

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

describe('buildRequestsUrl', () => {
  it('条件がなければ、/api/requests だけ', () => {
    expect(buildRequestsUrl()).toBe('/api/requests')
    expect(
      buildRequestsUrl({ q: '  ', qms: false, categoryId: null, status: null, sort: null }),
    ).toBe('/api/requests')
  })

  it('入っている条件だけを付ける', () => {
    const url = buildRequestsUrl({
      qms: true,
      categoryId: 4,
      status: '作業中',
      sort: 'due_on',
      includeArchived: true,
    })
    const params = new URL(url, 'http://x').searchParams
    expect(params.get('qms')).toBe('true')
    expect(params.get('category_id')).toBe('4')
    expect(params.get('status')).toBe('作業中')
    expect(params.get('sort')).toBe('due_on')
    expect(params.get('include_archived')).toBe('true')
    expect(params.has('q')).toBe(false)
  })

  it('検索の文字は、前後の空白を取って、安全な形に直して付ける', () => {
    const url = buildRequestsUrl({ q: ' 100%&通関 ' })
    expect(url).toBe('/api/requests?q=100%25%26%E9%80%9A%E9%96%A2')
    expect(new URL(url, 'http://x').searchParams.get('q')).toBe('100%&通関')
  })

  it('カテゴリーの番号が 0 でも、条件として付ける', () => {
    expect(buildRequestsUrl({ categoryId: 0 })).toBe('/api/requests?category_id=0')
  })
})

describe('fetchCategories', () => {
  it('/api/categories を呼び、配列を返す', async () => {
    mockFetch(async () => ({ ok: true, json: async () => [{ id: 1, name: 'HP' }] }))
    expect(await fetchCategories()).toEqual([{ id: 1, name: 'HP' }])
    expect(fetch).toHaveBeenCalledWith('/api/categories')
  })
})

describe('fetchConfirmTargets', () => {
  it('/api/confirm-targets を呼び、文字の配列を返す', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ['依頼者', '薬事部'] }))
    expect(await fetchConfirmTargets()).toEqual(['依頼者', '薬事部'])
    expect(fetch).toHaveBeenCalledWith('/api/confirm-targets')
  })
})

describe('statusChangeToPatch', () => {
  it('確認先を指定しない変更では、confirm_to を送らない（以前の確認先を消さない）', () => {
    expect(statusChangeToPatch({ id: 1, status: '完了' })).toEqual({ status: '完了' })
  })

  it('確認待ちにするときは、確認先の前後の空白を取って送る', () => {
    expect(statusChangeToPatch({ id: 1, status: '確認待ち', confirmTo: ' 薬事部 ' })).toEqual({
      status: '確認待ち',
      confirm_to: '薬事部',
    })
  })

  it('確認先が空なら、null（未入力）にする', () => {
    expect(statusChangeToPatch({ id: 1, status: '確認待ち', confirmTo: '  ' })).toEqual({
      status: '確認待ち',
      confirm_to: null,
    })
    expect(statusChangeToPatch({ id: 1, status: '確認待ち', confirmTo: null })).toEqual({
      status: '確認待ち',
      confirm_to: null,
    })
  })
})

describe('updateRequest', () => {
  it('PATCH で、送る項目を JSON にして送る', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({}) }))
    await updateRequest(9, { status: '作業中' })
    expect(fetch).toHaveBeenCalledWith('/api/requests/9', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{"status":"作業中"}',
    })
  })

  it('API がエラーの番号を返したら、例外を投げる', async () => {
    mockFetch(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    await expect(updateRequest(9, { status: '完了' })).rejects.toThrow('404')
  })

  it('API につながらなかったら、例外を投げる', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(updateRequest(9, { status: '完了' })).rejects.toThrow()
  })
})

describe('fetchRequest / fetchRequesters', () => {
  it('依頼1件は、/api/requests/{id} を呼ぶ', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ id: 9 }) }))
    expect(await fetchRequest(9)).toEqual({ id: 9 })
    expect(fetch).toHaveBeenCalledWith('/api/requests/9')
  })

  it('見つからない（404）ときは、例外を投げる', async () => {
    mockFetch(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    await expect(fetchRequest(9)).rejects.toThrow('404')
  })

  it('依頼者の一覧は、/api/requesters を呼ぶ', async () => {
    mockFetch(async () => ({ ok: true, json: async () => [{ id: 1 }] }))
    expect(await fetchRequesters()).toEqual([{ id: 1 }])
    expect(fetch).toHaveBeenCalledWith('/api/requesters')
  })
})

describe('createRequester / updateRequesterExtension', () => {
  it('同じ名前がすでにあるとき（409）は、例外を投げる', async () => {
    mockFetch(async () => ({ ok: false, status: 409, json: async () => ({}) }))
    await expect(createRequester('（架空）山田', '')).rejects.toThrow('409')
  })

  it('内線番号の変更で、API がエラーを返したら、例外を投げる', async () => {
    mockFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    await expect(updateRequesterExtension(2, '1')).rejects.toThrow('500')
  })
})

describe('createRequest', () => {
  it('POST で、依頼の内容を JSON にして送り、できた依頼を返す', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ id: 12 }) }))
    const created = await createRequest({ title: '（架空）依頼', category_id: 4 })
    expect(created).toEqual({ id: 12 })
    expect(fetch).toHaveBeenCalledWith('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"title":"（架空）依頼","category_id":4}',
    })
  })

  it('API がエラー（422 など）を返したら、例外を投げる', async () => {
    mockFetch(async () => ({ ok: false, status: 422, json: async () => ({}) }))
    await expect(createRequest({ title: '' })).rejects.toThrow('422')
  })
})

describe('fetchTemplateItems', () => {
  it('カテゴリーのテンプレートを呼び、項目名の配列にして返す', async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => [{ name: '原稿の確認' }, { name: '校正' }],
    }))
    expect(await fetchTemplateItems(4)).toEqual(['原稿の確認', '校正'])
    expect(fetch).toHaveBeenCalledWith('/api/categories/4/template-items')
  })

  it('API がエラーを返したら、例外を投げる', async () => {
    mockFetch(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    await expect(fetchTemplateItems(4)).rejects.toThrow('404')
  })
})

describe('deleteRequest / archived', () => {
  it('DELETE で、依頼の番号を呼ぶ', async () => {
    mockFetch(async () => ({ ok: true, status: 204 }))
    await deleteRequest(9)
    expect(fetch).toHaveBeenCalledWith('/api/requests/9', { method: 'DELETE' })
  })

  it('アーカイブ中でない依頼の削除（409）は、例外を投げる', async () => {
    mockFetch(async () => ({ ok: false, status: 409, json: async () => ({}) }))
    await expect(deleteRequest(9)).rejects.toThrow('409')
  })

  it('API につながらなかったら、例外を投げる', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(deleteRequest(9)).rejects.toThrow()
  })

  it('アーカイブ・元に戻すは、archived だけを PATCH で送る', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({}) }))
    await updateRequest(9, { archived: true })
    expect(fetch).toHaveBeenCalledWith('/api/requests/9', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{"archived":true}',
    })
    await updateRequest(9, { archived: false })
    expect(fetch).toHaveBeenLastCalledWith('/api/requests/9', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{"archived":false}',
    })
  })
})
