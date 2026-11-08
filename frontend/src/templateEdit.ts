/** テンプレート編集の決まりごと。画面の部品から切り離して、テストしやすくする。どれも、元の配列を書き換えない。 */

/** 項目名の長さの上限（API と同じ。docs/data-model.md の template_item.name） */
export const TEMPLATE_ITEM_NAME_MAX = 200

/** 項目を、最後に足す。名前の前後の空白は取る。空なら、何も足さない。 */
export function addTemplateItem(names: string[], name: string): string[] {
  const trimmed = name.trim()
  if (!trimmed) return names
  return [...names, trimmed]
}

/** 番号（0 から）の項目を消す。 */
export function removeTemplateItem(names: string[], index: number): string[] {
  return names.filter((_, i) => i !== index)
}

/** 番号（0 から）の項目の名前を、直す。 */
export function renameTemplateItem(names: string[], index: number, name: string): string[] {
  return names.map((current, i) => (i === index ? name : current))
}

/** 保存する形にする（前後の空白を取る）。 */
export function normalizeTemplate(names: string[]): string[] {
  return names.map((name) => name.trim())
}

/**
 * 保存してよいか確かめる。問題があれば、何番目の項目かを添えたメッセージを返す。
 * （空の名前は、API が 422 で断る。画面で先に、分かりやすく伝える）
 */
export function validateTemplate(names: string[]): string | null {
  for (const [index, name] of normalizeTemplate(names).entries()) {
    if (!name) return `${index + 1}番目の項目の名前が空です`
    if (name.length > TEMPLATE_ITEM_NAME_MAX) {
      return `${index + 1}番目の項目は、${TEMPLATE_ITEM_NAME_MAX}文字までです`
    }
  }
  return null
}

/** 開いたときの内容から、変わっているか（保存していない変更があるか）。前後の空白だけの違いは、変更と見なさない。 */
export function isTemplateChanged(original: string[], current: string[]): boolean {
  const now = normalizeTemplate(current)
  return original.length !== now.length || original.some((name, i) => name !== now[i])
}
