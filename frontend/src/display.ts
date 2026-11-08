/** 表示のための決まり（色、日付の整形、進み具合の文字）。色は、ここの1か所にまとめる。 */
import type { DueLevel, Priority, RequestQuery, RequestRow, SortKey, Status } from './types'

export const STATUS_COLOR: Record<Status, string> = {
  未着手: 'grey',
  作業中: 'blue',
  確認待ち: '#A8329E',
  完了: 'green',
  ペンディング: 'brown',
}

export const PRIORITY_COLOR: Record<Priority, string> = {
  急ぎ: 'red',
  高: 'orange',
  中: 'blue',
  低: 'grey',
}

/** 並び替えの選択肢（先頭が、最初に開いたときの手動の並び） */
export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: null, label: '手動の並び' },
  { value: 'priority', label: '優先度' },
  { value: 'due_on', label: '期限日' },
  { value: 'status', label: 'ステータス' },
]

/** 検索・絞り込みの条件が1つでも入っているか（並び替えと「アーカイブも表示」は、含めない） */
export function hasActiveFilter(
  query: Pick<RequestQuery, 'q' | 'qms' | 'categoryId' | 'status'>,
): boolean {
  return query.q.trim() !== '' || query.qms || query.categoryId !== null || query.status !== null
}

/** 例：2026-11-10 → 11/10（火）。曜日は、日付だけで決まる（タイムゾーンの影響を受けない） */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const weekday = '日月火水木金土'[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${month}/${day}（${weekday}）`
}

/** チェックリストの進み具合。項目がないときは空（画面には何も出さない） */
export function progressText(row: Pick<RequestRow, 'checklist_done' | 'checklist_total'>): string {
  if (row.checklist_total === 0) return ''
  return `${row.checklist_done}/${row.checklist_total} 完了`
}

/**
 * 期限の色を、読み上げソフト向けの文字にする。色（赤・オレンジ）は、見える人にしか伝わらないため。
 * 色なし（null）のときは、空。
 */
export function dueLevelLabel(level: DueLevel): string {
  if (level === 'overdue') return '期限切れ'
  if (level === 'soon') return '3営業日以内'
  return ''
}
