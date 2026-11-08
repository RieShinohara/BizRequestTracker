import { describe, expect, it } from 'vitest'
import { dueLevelLabel, formatDate, hasActiveFilter, progressText } from './display'

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

describe('hasActiveFilter', () => {
  const none = { q: '', qms: false, categoryId: null, status: null }

  it('条件がなければ、false', () => {
    expect(hasActiveFilter(none)).toBe(false)
    expect(hasActiveFilter({ ...none, q: '   ' })).toBe(false)
  })

  it('どれか1つでも入っていれば、true', () => {
    expect(hasActiveFilter({ ...none, q: '通関' })).toBe(true)
    expect(hasActiveFilter({ ...none, qms: true })).toBe(true)
    expect(hasActiveFilter({ ...none, categoryId: 0 })).toBe(true)
    expect(hasActiveFilter({ ...none, status: '完了' })).toBe(true)
  })
})

describe('dueLevelLabel', () => {
  it('期限切れ・3営業日以内を、文字にする', () => {
    expect(dueLevelLabel('overdue')).toBe('期限切れ')
    expect(dueLevelLabel('soon')).toBe('3営業日以内')
  })

  it('色なし（null）は、空', () => {
    expect(dueLevelLabel(null)).toBe('')
  })
})
