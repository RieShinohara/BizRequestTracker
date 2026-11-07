import { describe, expect, it } from 'vitest'
import { formatDate, progressText } from './display'

describe('formatDate', () => {
  it('月/日（曜日）の形にする', () => {
    expect(formatDate('2026-11-10')).toBe('11/10（火）')
    expect(formatDate('2026-11-08')).toBe('11/8（日）')
  })

  it('年をまたぐ日付でも、曜日が合う', () => {
    expect(formatDate('2027-01-01')).toBe('1/1（金）')
  })
})

describe('progressText', () => {
  it('チェックリストがあるときは「完了数/全体 完了」', () => {
    expect(progressText({ checklist_done: 3, checklist_total: 6 })).toBe('3/6 完了')
  })

  it('チェックリストがないときは、空', () => {
    expect(progressText({ checklist_done: 0, checklist_total: 0 })).toBe('')
  })
})
