/** 手動の並び（ドラッグ）の計算。画面の部品から切り離して、テストしやすくする。 */
import { hasActiveFilter } from './display'
import type { RequestQuery, RequestRow } from './types'

/** 配列の中で、from 番目の要素を、to 番目に移した、新しい配列を返す（元の配列は書き換えない）。 */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) return items
  const moved = [...items]
  const [item] = moved.splice(from, 1)
  moved.splice(to, 0, item)
  return moved
}

/**
 * 並びの保存（PUT /api/requests/order）で送る番号。アーカイブ中を除いた、依頼の番号を、
 * 一覧の並びのまま返す（アーカイブ中の依頼の並びは、API が変えない）。
 */
export function orderIds(rows: Pick<RequestRow, 'id' | 'archived'>[]): number[] {
  return rows.filter((row) => !row.archived).map((row) => row.id)
}

/**
 * ドラッグできない理由。ドラッグできるときは null。
 * ドラッグできるのは、手動の並びで、検索・絞り込みをしていないときだけ
 * （並び替えや絞り込みの途中で動かすと、「全体の並び」のどこに入れたのかが、分からなくなるため）。
 */
export function dragDisabledReason(query: RequestQuery): string | null {
  if (query.sort !== null) {
    return '並び替え中は、ドラッグできません。「手動の並び」に戻すと、動かせます'
  }
  if (hasActiveFilter(query)) {
    return '検索・絞り込み中は、ドラッグできません。条件を外すと、動かせます'
  }
  return null
}
