/** カテゴリー管理の決まりごと。画面の部品から切り離して、テストしやすくする。 */
import type { CategoryWithCount } from './types'

/** カテゴリー名の長さの上限（API と同じ。docs/data-model.md） */
export const CATEGORY_NAME_MAX = 100

/** 入力された名前を確かめる。問題があれば、メッセージを返す（前後の空白は、無視する）。 */
export function validateCategoryName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'カテゴリー名を入力してください'
  if (trimmed.length > CATEGORY_NAME_MAX) {
    return `カテゴリー名は${CATEGORY_NAME_MAX}文字までです`
  }
  return null
}

/** 削除できない理由（削除できるときは null）。依頼が1件でも使っているカテゴリーは、削除できない。 */
export function deleteBlockedReason(category: CategoryWithCount): string | null {
  if (category.request_count > 0) {
    return `このカテゴリーを使っている依頼が${category.request_count}件あるため、削除できません`
  }
  return null
}

/** 指定した番号のカテゴリーが、一覧にあるか（削除されたカテゴリーで絞り込んだままにしないため） */
export function hasCategory(categories: { id: number }[], id: number | null): boolean {
  return id !== null && categories.some((category) => category.id === id)
}
