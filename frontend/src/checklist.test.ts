import { describe, expect, it } from 'vitest'
import { addItem, mergeTemplate, removeItem, sameChecklist, setDone } from './checklist'

const items = [
  { name: '書類A', done: true },
  { name: '書類B', done: false },
]

describe('addItem', () => {
  it('最後に足す（名前の前後の空白は取る。チェックは外れている）', () => {
    expect(addItem(items, '  書類C ')).toEqual([...items, { name: '書類C', done: false }])
  })

  it('空・空白だけなら、何も足さない（同じ配列を返す）', () => {
    expect(addItem(items, '')).toBe(items)
    expect(addItem(items, '   ')).toBe(items)
  })

  it('元の配列は、書き換えない', () => {
    addItem(items, '書類C')
    expect(items).toHaveLength(2)
  })
})

describe('removeItem / setDone', () => {
  it('番号の項目だけを消す', () => {
    expect(removeItem(items, 0)).toEqual([{ name: '書類B', done: false }])
  })

  it('番号の項目だけ、チェックを付ける・外す', () => {
    expect(setDone(items, 1, true)).toEqual([
      { name: '書類A', done: true },
      { name: '書類B', done: true },
    ])
    expect(setDone(items, 0, false)[0].done).toBe(false)
    expect(items[1].done).toBe(false) // 元は、変わらない
  })
})

describe('mergeTemplate', () => {
  it('空のチェックリストには、テンプレートの順番で入る', () => {
    expect(mergeTemplate([], ['原稿', '校正'])).toEqual([
      { name: '原稿', done: false },
      { name: '校正', done: false },
    ])
  })

  it('すでに項目があるときは、残したまま、後ろに足す（チェックも残る）', () => {
    expect(mergeTemplate(items, ['書類C'])).toEqual([...items, { name: '書類C', done: false }])
  })

  it('同じ名前の項目は、重ねて入れない', () => {
    const merged = mergeTemplate(items, ['書類A', '書類C'])
    expect(merged.map((item) => item.name)).toEqual(['書類A', '書類B', '書類C'])
    expect(merged[0].done).toBe(true) // もとのチェックは、そのまま
  })

  it('もう一度入れても、増えない（同じ配列を返す）', () => {
    const once = mergeTemplate([], ['原稿', '校正'])
    expect(mergeTemplate(once, ['原稿', '校正'])).toBe(once)
  })

  it('テンプレートの中の重なりと、空の名前は、1つにする・無視する', () => {
    expect(mergeTemplate([], ['原稿', '原稿', ' ', ' 校正 '])).toEqual([
      { name: '原稿', done: false },
      { name: '校正', done: false },
    ])
  })
})

describe('sameChecklist', () => {
  it('名前・チェック・順番が同じなら、true', () => {
    expect(
      sameChecklist(
        items,
        items.map((item) => ({ ...item })),
      ),
    ).toBe(true)
    expect(sameChecklist([], [])).toBe(true)
  })

  it('1つでも違えば、false', () => {
    expect(sameChecklist(items, [items[0]])).toBe(false)
    expect(sameChecklist(items, setDone(items, 1, true))).toBe(false)
    expect(sameChecklist(items, [items[1], items[0]])).toBe(false)
    expect(sameChecklist(items, [{ ...items[0], name: '書類X' }, items[1]])).toBe(false)
  })
})
