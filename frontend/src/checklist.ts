/** チェックリストの操作。画面の部品から切り離して、テストしやすくする。どれも、元の配列を書き換えず、新しい配列を返す。 */
import type { ChecklistItem } from './types'

/** 項目を、最後に足す。名前の前後の空白は取る。空なら、何も足さない。 */
export function addItem(items: ChecklistItem[], name: string): ChecklistItem[] {
  const trimmed = name.trim()
  if (!trimmed) return items
  return [...items, { name: trimmed, done: false }]
}

/** 番号（0 から）の項目を消す。 */
export function removeItem(items: ChecklistItem[], index: number): ChecklistItem[] {
  return items.filter((_, i) => i !== index)
}

/** 番号（0 から）の項目のチェックを、付ける・外す。 */
export function setDone(items: ChecklistItem[], index: number, done: boolean): ChecklistItem[] {
  return items.map((item, i) => (i === index ? { ...item, done } : item))
}

/**
 * テンプレートの項目を、後ろに足す。すでに同じ名前の項目があるときは、重ねて入れない
 * （もう一度「テンプレートを入れる」を押しても、増えない）。
 */
export function mergeTemplate(items: ChecklistItem[], templateNames: string[]): ChecklistItem[] {
  const names = new Set(items.map((item) => item.name))
  const added: ChecklistItem[] = []
  for (const raw of templateNames) {
    const name = raw.trim()
    if (!name || names.has(name)) continue
    names.add(name) // テンプレートの中の重なりも、1つにする
    added.push({ name, done: false })
  }
  return added.length === 0 ? items : [...items, ...added]
}

/** 2つのチェックリストが、同じ内容か（項目の名前・チェック・順番）。変えていないときは、保存で送らないために使う。 */
export function sameChecklist(a: ChecklistItem[], b: ChecklistItem[]): boolean {
  return (
    a.length === b.length &&
    a.every((item, i) => item.name === b[i].name && item.done === b[i].done)
  )
}
