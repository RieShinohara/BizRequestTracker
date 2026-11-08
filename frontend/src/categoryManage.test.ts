import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createCategory, deleteCategory, renameCategory } from './api'
import {
  CATEGORY_NAME_MAX,
  deleteBlockedReason,
  hasCategory,
  validateCategoryName,
} from './categoryManage'

function mockFetch(implementation: () => Promise<unknown>) {
  vi.stubGlobal('fetch', vi.fn(implementation))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('validateCategoryName', () => {
  it('空や空白だけは、メッセージを返す', () => {
    expect(validateCategoryName('')).toBe('カテゴリー名を入力してください')
    expect(validateCategoryName('   ')).toBe('カテゴリー名を入力してください')
  })

  it('ふつうの名前は、null（問題なし）', () => {
    expect(validateCategoryName('通関')).toBeNull()
    expect(validateCategoryName('  通関  ')).toBeNull()
  })

  it('上限ちょうどは通り、1文字超えるとメッセージ（前後の空白は数えない）', () => {
    expect(validateCategoryName('あ'.repeat(CATEGORY_NAME_MAX))).toBeNull()
    expect(validateCategoryName(` ${'あ'.repeat(CATEGORY_NAME_MAX)} `)).toBeNull()
    expect(validateCategoryName('あ'.repeat(CATEGORY_NAME_MAX + 1))).toBe(
      'カテゴリー名は100文字までです',
    )
  })
})

describe('deleteBlockedReason', () => {
  it('依頼が1件でも使っていたら、件数つきの理由を返す', () => {
    expect(deleteBlockedReason({ id: 1, name: 'HP', request_count: 3 })).toBe(
      'このカテゴリーを使っている依頼が3件あるため、削除できません',
    )
    expect(deleteBlockedReason({ id: 1, name: 'HP', request_count: 1 })).not.toBeNull()
  })

  it('使っている依頼が 0 件なら、null（削除できる）', () => {
    expect(deleteBlockedReason({ id: 1, name: 'HP', request_count: 0 })).toBeNull()
  })
})

describe('hasCategory', () => {
  const list = [{ id: 1 }, { id: 5 }]
  it('一覧にある番号だけ true', () => {
    expect(hasCategory(list, 5)).toBe(true)
    expect(hasCategory(list, 2)).toBe(false)
    expect(hasCategory(list, null)).toBe(false)
  })
})

describe('createCategory', () => {
  it('POST /api/categories に名前を送り、作られたカテゴリーを返す', async () => {
    const created = { id: 8, name: '新しい業務', request_count: 0 }
    mockFetch(async () => ({ ok: true, status: 201, json: async () => created }))
    expect(await createCategory('新しい業務')).toEqual(created)
    expect(fetch).toHaveBeenCalledWith('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '新しい業務' }),
    })
  })

  it('409 のとき、API の理由つきの ApiError を投げる', async () => {
    mockFetch(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ detail: '同じ名前のカテゴリーがすでにあります' }),
    }))
    const error = await createCategory('HP').catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(409)
    expect(error.detail).toBe('同じ名前のカテゴリーがすでにあります')
  })

  it('理由が文字でない（入力の検査の 422 は、配列）とき、detail は null', async () => {
    mockFetch(async () => ({
      ok: false,
      status: 422,
      json: async () => ({ detail: [{ msg: 'too short' }] }),
    }))
    const error = await createCategory('').catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.detail).toBeNull()
  })

  it('返事が JSON でなくても、番号だけの ApiError を投げる', async () => {
    mockFetch(async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    }))
    const error = await createCategory('HP').catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(502)
    expect(error.detail).toBeNull()
  })
})

describe('renameCategory', () => {
  it('PATCH /api/categories/{id} に新しい名前を送る', async () => {
    const renamed = { id: 3, name: '通関書類', request_count: 2 }
    mockFetch(async () => ({ ok: true, status: 200, json: async () => renamed }))
    expect(await renameCategory(3, '通関書類')).toEqual(renamed)
    expect(fetch).toHaveBeenCalledWith('/api/categories/3', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '通関書類' }),
    })
  })
})

describe('deleteCategory', () => {
  it('DELETE /api/categories/{id} を呼ぶ（204 は、中身なしで成功）', async () => {
    mockFetch(async () => ({ ok: true, status: 204 }))
    await expect(deleteCategory(4)).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith('/api/categories/4', {
      method: 'DELETE',
      headers: undefined,
      body: undefined,
    })
  })

  it('依頼が使っているとき（409）は、理由つきの ApiError を投げる', async () => {
    mockFetch(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ detail: 'このカテゴリーを使っている依頼があるため、削除できません' }),
    }))
    const error = await deleteCategory(4).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.detail).toBe('このカテゴリーを使っている依頼があるため、削除できません')
  })
})
