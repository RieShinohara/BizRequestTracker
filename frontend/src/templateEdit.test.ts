import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, saveTemplateItems } from './api'
import {
  TEMPLATE_ITEM_NAME_MAX,
  addTemplateItem,
  isTemplateChanged,
  normalizeTemplate,
  removeTemplateItem,
  renameTemplateItem,
  validateTemplate,
} from './templateEdit'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('addTemplateItem', () => {
  it('最後に足す（前後の空白は取る）', () => {
    expect(addTemplateItem(['A'], '  B  ')).toEqual(['A', 'B'])
  })

  it('空や空白だけなら、何も足さない（同じ配列を返す）', () => {
    const names = ['A']
    expect(addTemplateItem(names, '')).toBe(names)
    expect(addTemplateItem(names, '   ')).toBe(names)
  })

  it('元の配列を書き換えない', () => {
    const names = ['A']
    addTemplateItem(names, 'B')
    expect(names).toEqual(['A'])
  })
})

describe('removeTemplateItem', () => {
  it('番号の項目だけ消す', () => {
    expect(removeTemplateItem(['A', 'B', 'C'], 1)).toEqual(['A', 'C'])
  })

  it('範囲外の番号なら、何も消えない', () => {
    expect(removeTemplateItem(['A'], 5)).toEqual(['A'])
  })
})

describe('renameTemplateItem', () => {
  it('番号の項目の名前だけ直す', () => {
    expect(renameTemplateItem(['A', 'B'], 1, 'X')).toEqual(['A', 'X'])
  })
})

describe('validateTemplate', () => {
  it('問題がなければ、null（空の一覧もよい。テンプレートを空にできる）', () => {
    expect(validateTemplate(['A', 'B'])).toBeNull()
    expect(validateTemplate([])).toBeNull()
  })

  it('空の名前は、何番目かを添えて知らせる（空白だけも空）', () => {
    expect(validateTemplate(['A', ''])).toBe('2番目の項目の名前が空です')
    expect(validateTemplate(['   ', 'B'])).toBe('1番目の項目の名前が空です')
  })

  it('上限ちょうどは通り、1文字超えると知らせる（前後の空白は数えない）', () => {
    expect(validateTemplate(['あ'.repeat(TEMPLATE_ITEM_NAME_MAX)])).toBeNull()
    expect(validateTemplate([` ${'あ'.repeat(TEMPLATE_ITEM_NAME_MAX)} `])).toBeNull()
    expect(validateTemplate(['A', 'あ'.repeat(TEMPLATE_ITEM_NAME_MAX + 1)])).toBe(
      '2番目の項目は、200文字までです',
    )
  })
})

describe('normalizeTemplate', () => {
  it('前後の空白を取る', () => {
    expect(normalizeTemplate([' A ', 'B'])).toEqual(['A', 'B'])
  })
})

describe('isTemplateChanged', () => {
  it('同じ内容なら、変更なし', () => {
    expect(isTemplateChanged(['A', 'B'], ['A', 'B'])).toBe(false)
    expect(isTemplateChanged([], [])).toBe(false)
  })

  it('前後の空白だけの違いは、変更と見なさない', () => {
    expect(isTemplateChanged(['A'], [' A '])).toBe(false)
  })

  it('名前・個数・順番が違えば、変更あり', () => {
    expect(isTemplateChanged(['A'], ['B'])).toBe(true)
    expect(isTemplateChanged(['A'], ['A', 'B'])).toBe(true)
    expect(isTemplateChanged(['A', 'B'], ['B', 'A'])).toBe(true)
    expect(isTemplateChanged(['A', 'B'], ['A'])).toBe(true)
  })
})

describe('saveTemplateItems', () => {
  it('PUT で、名前を {name} の配列にして送り、保存された順の名前を返す', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [{ name: '原稿の確認' }, { name: '納品' }],
      })),
    )
    expect(await saveTemplateItems(7, ['原稿の確認', '納品'])).toEqual(['原稿の確認', '納品'])
    expect(fetch).toHaveBeenCalledWith('/api/categories/7/template-items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ name: '原稿の確認' }, { name: '納品' }] }),
    })
  })

  it('空の一覧も送れる（テンプレートを空にする）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })),
    )
    expect(await saveTemplateItems(7, [])).toEqual([])
    expect(fetch).toHaveBeenCalledWith(
      '/api/categories/7/template-items',
      expect.objectContaining({ body: JSON.stringify({ items: [] }) }),
    )
  })

  it('失敗したら、理由つきの ApiError を投げる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'カテゴリーが見つかりません' }),
      })),
    )
    const error = await saveTemplateItems(999, ['A']).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(404)
    expect(error.detail).toBe('カテゴリーが見つかりません')
  })
})
