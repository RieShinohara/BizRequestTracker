import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  REQUIRED_MESSAGE,
  detailToForm,
  formToPatch,
  resolveRequesterId,
  validateForm,
  type RequestForm,
} from './requestForm'
import type { RequestDetail } from './types'

afterEach(() => {
  vi.unstubAllGlobals()
})

const detail: RequestDetail = {
  id: 9,
  title: '（架空）通関書類の作成',
  requester: { id: 2, name: '（架空）山田', extension: '1234' },
  category: { id: 4, name: '通関' },
  status: '作業中',
  priority: '高',
  confirm_to: null,
  due_on: '2026-11-10',
  qms: true,
  archived: false,
  checklist_done: 0,
  checklist_total: 0,
  due_level: null,
  description: null,
  received_on: '2026-11-01',
  checklist_items: [],
}

function form(patch: Partial<RequestForm> = {}): RequestForm {
  return { ...detailToForm(detail), ...patch }
}

describe('detailToForm', () => {
  it('API の値を入力欄の形にする（null は、空の文字）', () => {
    expect(detailToForm(detail)).toEqual({
      title: '（架空）通関書類の作成',
      status: '作業中',
      priority: '高',
      description: '',
      requesterName: '（架空）山田',
      requesterExtension: '1234',
      categoryId: 4,
      confirmTo: '',
      receivedOn: '2026-11-01',
      dueOn: '2026-11-10',
      qms: true,
    })
  })

  it('内線番号が null の依頼者は、空の文字', () => {
    const noExt = { ...detail, requester: { ...detail.requester, extension: null } }
    expect(detailToForm(noExt).requesterExtension).toBe('')
  })
})

describe('validateForm', () => {
  it('必須の項目が入っていれば、問題なし', () => {
    expect(validateForm(form())).toBeNull()
  })

  it.each([
    ['タイトルが空', { title: '' }],
    ['タイトルが空白だけ', { title: '   ' }],
    ['依頼者が空', { requesterName: '' }],
    ['依頼者が空白だけ', { requesterName: '  ' }],
    ['期限日が空', { dueOn: '' }],
  ])('%s なら、メッセージを返す', (_name, patch) => {
    expect(validateForm(form(patch))).toBe(REQUIRED_MESSAGE)
  })

  it('詳細・確認先・内線番号が空でも、問題なし', () => {
    expect(
      validateForm(form({ description: '', confirmTo: '', requesterExtension: '' })),
    ).toBeNull()
  })
})

describe('formToPatch', () => {
  it('入力内容を API に送る形にする（空の詳細は null）', () => {
    expect(formToPatch(form({ title: ' 新しいタイトル ' }), 2)).toEqual({
      title: '新しいタイトル',
      description: null,
      requester_id: 2,
      category_id: 4,
      due_on: '2026-11-10',
      status: '作業中',
      priority: '高',
      qms: true,
      received_on: '2026-11-01',
    })
  })

  it('確認待ちのときだけ、確認先を送る（前後の空白は取る。空なら null）', () => {
    expect(formToPatch(form({ status: '確認待ち', confirmTo: ' 薬事部 ' }), 2).confirm_to).toBe(
      '薬事部',
    )
    expect(formToPatch(form({ status: '確認待ち', confirmTo: '' }), 2).confirm_to).toBeNull()
  })

  it('確認待ち以外では、確認先を送らない（残っている確認先を消さない）', () => {
    const patch = formToPatch(form({ status: '完了', confirmTo: '薬事部' }), 2)
    expect('confirm_to' in patch).toBe(false)
  })

  it('受付日が空なら、送らない', () => {
    expect('received_on' in formToPatch(form({ receivedOn: '' }), 2)).toBe(false)
  })
})

describe('resolveRequesterId', () => {
  const requesters = [
    { id: 2, name: '（架空）山田', extension: '1234' },
    { id: 3, name: '（架空）佐藤', extension: null },
  ]

  function mockFetch(body: unknown = {}) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => body })),
    )
  }

  it('登録済みの名前で、内線番号も同じなら、API を呼ばずに番号を返す', async () => {
    mockFetch()
    const id = await resolveRequesterId(
      { requesterName: '（架空）山田', requesterExtension: '1234' },
      requesters,
    )
    expect(id).toBe(2)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('内線番号が null の人で、空のままなら、API を呼ばない', async () => {
    mockFetch()
    const id = await resolveRequesterId(
      { requesterName: '（架空）佐藤', requesterExtension: '' },
      requesters,
    )
    expect(id).toBe(3)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('登録済みの名前で、内線番号が変わっていたら、その人の内線番号を直す', async () => {
    mockFetch()
    const id = await resolveRequesterId(
      { requesterName: '（架空）山田', requesterExtension: ' 9999 ' },
      requesters,
    )
    expect(id).toBe(2)
    expect(fetch).toHaveBeenCalledWith('/api/requesters/2', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{"extension":"9999"}',
    })
  })

  it('新しい名前なら、登録して、できた人の番号を返す', async () => {
    mockFetch({ id: 10, name: '（架空）鈴木', extension: '1111' })
    const id = await resolveRequesterId(
      { requesterName: ' （架空）鈴木 ', requesterExtension: '1111' },
      requesters,
    )
    expect(id).toBe(10)
    expect(fetch).toHaveBeenCalledWith('/api/requesters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name":"（架空）鈴木","extension":"1111"}',
    })
  })
})
