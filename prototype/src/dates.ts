import type { Request } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayIso(): string {
  return toIso(new Date())
}

export function addDays(iso: string, days: number): string {
  const d = fromIso(iso)
  d.setDate(d.getDate() + days)
  return toIso(d)
}

// プロトタイプ用の祝日（一部だけ）。本番は、日本の祝日を判定するライブラリを使う。
const HOLIDAYS = new Set([
  '2026-11-23',
  '2027-01-11',
  '2027-02-11',
  '2027-02-23',
])

// 会社の休み：毎年 12/29〜1/3（年末年始）と 8/12〜15（夏休み）
function isCompanyHoliday(d: Date): boolean {
  const m = d.getMonth() + 1
  const day = d.getDate()
  if (m === 12 && day >= 29) return true
  if (m === 1 && day <= 3) return true
  if (m === 8 && day >= 12 && day <= 15) return true
  return false
}

export function isBusinessDay(d: Date): boolean {
  const w = d.getDay()
  if (w === 0 || w === 6) return false
  if (HOLIDAYS.has(toIso(d))) return false
  return !isCompanyHoliday(d)
}

// 今日の翌日から期限日までの営業日の数（期限日を含む）
export function businessDaysUntil(dueIso: string, fromIsoDate = todayIso()): number {
  const due = fromIso(dueIso)
  const d = fromIso(fromIsoDate)
  let count = 0
  d.setDate(d.getDate() + 1)
  while (d <= due) {
    if (isBusinessDay(d)) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

export type DueLevel = 'overdue' | 'soon' | 'none'

// 完了・ペンディング・アーカイブ中は、色分けしない
export function dueLevel(r: Pick<Request, 'dueOn' | 'status' | 'archived'>): DueLevel {
  if (r.archived || r.status === '完了' || r.status === 'ペンディング') return 'none'
  const today = todayIso()
  if (r.dueOn < today) return 'overdue'
  return businessDaysUntil(r.dueOn, today) <= 3 ? 'soon' : 'none'
}

export function formatDate(iso: string): string {
  const d = fromIso(iso)
  const w = '日月火水木金土'[d.getDay()]
  return `${d.getMonth() + 1}/${d.getDate()}（${w}）`
}
