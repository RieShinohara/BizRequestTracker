import { describe, expect, it } from 'vitest'
import { dragDisabledReason, moveItem, orderIds } from './order'
import type { RequestQuery } from './types'

const none: RequestQuery = {
  q: '',
  qms: false,
  categoryId: null,
  status: null,
  sort: null,
  includeArchived: false,
}

describe('moveItem', () => {
  it('前から後ろへ、動かす', () => {
    expect(moveItem(['A', 'B', 'C', 'D'], 0, 2)).toEqual(['B', 'C', 'A', 'D'])
  })

  it('後ろから前へ、動かす', () => {
    expect(moveItem(['A', 'B', 'C', 'D'], 3, 1)).toEqual(['A', 'D', 'B', 'C'])
  })

  it('先頭・最後にも、動かせる', () => {
    expect(moveItem(['A', 'B', 'C'], 2, 0)).toEqual(['C', 'A', 'B'])
    expect(moveItem(['A', 'B', 'C'], 0, 2)).toEqual(['B', 'C', 'A'])
  })

  it('同じ位置・範囲の外なら、動かさない（同じ配列を返す）', () => {
    const items = ['A', 'B', 'C']
    expect(moveItem(items, 1, 1)).toBe(items)
    expect(moveItem(items, -1, 1)).toBe(items)
    expect(moveItem(items, 0, 3)).toBe(items)
  })

  it('元の配列は、書き換えない', () => {
    const items = ['A', 'B', 'C']
    moveItem(items, 0, 2)
    expect(items).toEqual(['A', 'B', 'C'])
  })
})

describe('orderIds', () => {
  it('アーカイブ中を除いて、一覧の並びのまま、番号を返す', () => {
    const rows = [
      { id: 5, archived: false },
      { id: 7, archived: true },
      { id: 2, archived: false },
      { id: 9, archived: false },
    ]
    expect(orderIds(rows)).toEqual([5, 2, 9])
  })

  it('空なら、空', () => {
    expect(orderIds([])).toEqual([])
  })
})

describe('dragDisabledReason', () => {
  it('手動の並びで、条件がなければ、ドラッグできる（null）', () => {
    expect(dragDisabledReason(none)).toBeNull()
  })

  it('「アーカイブも表示」だけなら、ドラッグできる', () => {
    expect(dragDisabledReason({ ...none, includeArchived: true })).toBeNull()
  })

  it.each([['priority'], ['due_on'], ['status']] as const)(
    '%s 順のときは、ドラッグできない（理由が出る）',
    (sort) => {
      expect(dragDisabledReason({ ...none, sort })).toContain('並び替え中')
    },
  )

  it.each([
    ['検索', { q: '通関' }],
    ['QMS', { qms: true }],
    ['カテゴリー', { categoryId: 4 }],
    ['ステータス', { status: '完了' as const }],
  ])('%s の絞り込み中は、ドラッグできない（理由が出る）', (_name, patch) => {
    expect(dragDisabledReason({ ...none, ...patch })).toContain('絞り込み中')
  })
})
