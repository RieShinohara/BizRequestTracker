import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CATEGORY_MESSAGE,
  REQUIRED_MESSAGE,
  emptyForm,
  detailToForm,
  formToPatch,
  isFormChanged,
  resolveRequesterId,
  todayIso,
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
      checklist: [],
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

describe('emptyForm / todayIso', () => {
  it('新しい依頼の初期値：未着手・中・受付日は今日・QMS オフ・カテゴリーは先頭', () => {
    expect(emptyForm(4, '2026-11-07')).toEqual({
      title: '',
      status: '未着手',
      priority: '中',
      description: '',
      requesterName: '',
      requesterExtension: '',
      categoryId: 4,
      confirmTo: '',
      receivedOn: '2026-11-07',
      dueOn: '',
      qms: false,
      checklist: [],
    })
  })

  it('空の入力欄では、必須のメッセージが出る', () => {
    expect(validateForm(emptyForm(4, '2026-11-07'))).toBe(REQUIRED_MESSAGE)
  })

  it('カテゴリーが未選択（1つもない）なら、カテゴリーのメッセージが出る', () => {
    const filled = emptyForm(null, '2026-11-07')
    filled.title = '（架空）依頼'
    filled.requesterName = '（架空）山田'
    filled.dueOn = '2026-11-20'
    expect(validateForm(filled)).toBe(CATEGORY_MESSAGE)
  })

  it('今日の日付は、パソコンの日付で決める（月・日は 0 で埋める）', () => {
    expect(todayIso(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05')
    expect(todayIso(new Date(2026, 10, 7, 23, 59))).toBe('2026-11-07')
  })

  it('必須を入れた新しい依頼は、API に送る形にできる（カテゴリーも送る）', () => {
    const filled = emptyForm(4, '2026-11-07')
    filled.title = '（架空）依頼'
    filled.requesterName = '（架空）山田'
    filled.dueOn = '2026-11-20'
    expect(validateForm(filled)).toBeNull()
    expect(formToPatch(filled, 2)).toMatchObject({
      title: '（架空）依頼',
      requester_id: 2,
      category_id: 4,
      due_on: '2026-11-20',
      status: '未着手',
      priority: '中',
      qms: false,
      received_on: '2026-11-07',
    })
  })
})

describe('formToPatch のチェックリスト', () => {
  const original = [
    { name: '書類A', done: true },
    { name: '書類B', done: false },
  ]

  it('変えていないときは、送らない', () => {
    const patch = formToPatch(
      form({ checklist: original.map((item) => ({ ...item })) }),
      2,
      original,
    )
    expect('checklist_items' in patch).toBe(false)
  })

  it('チェックや項目を変えたときは、一覧ごと送る', () => {
    const changed = [
      { name: '書類A', done: true },
      { name: '書類B', done: true },
    ]
    expect(formToPatch(form({ checklist: changed }), 2, original).checklist_items).toEqual(changed)
  })

  it('全部消したときは、空の一覧を送る（空にする）', () => {
    expect(formToPatch(form({ checklist: [] }), 2, original).checklist_items).toEqual([])
  })

  it('新しい依頼（元は空）で、項目を足したときは、送る。足さないときは、送らない', () => {
    const added = [{ name: '書類A', done: false }]
    expect(formToPatch(form({ checklist: added }), 2).checklist_items).toEqual(added)
    expect('checklist_items' in formToPatch(form({ checklist: [] }), 2)).toBe(false)
  })

  it('開いたときの値を、画面で直しても、元の値は変わらない', () => {
    const withChecklist = { ...detail, checklist_items: [{ name: '書類A', done: false }] }
    const f = detailToForm(withChecklist)
    f.checklist[0].done = true
    expect(withChecklist.checklist_items[0].done).toBe(false)
  })
})

describe('isFormChanged', () => {
  it('開いたままの内容（別に作った写し）は、変更なし', () => {
    expect(isFormChanged(detailToForm(detail), detailToForm(detail))).toBe(false)
    expect(isFormChanged(emptyForm(4, '2026-11-08'), emptyForm(4, '2026-11-08'))).toBe(false)
  })

  it('どの項目を変えても、変更あり', () => {
    const original = detailToForm(detail)
    const changes: Partial<RequestForm>[] = [
      { title: '別のタイトル' },
      { description: '詳細を足した' },
      { requesterName: '（架空）佐藤' },
      { requesterExtension: '9999' },
      { confirmTo: '薬事部' },
      { status: '完了' },
      { priority: '低' },
      { categoryId: 5 },
      { receivedOn: '2026-11-02' },
      { dueOn: '2026-11-11' },
      { qms: false },
      { checklist: [{ name: '書類A', done: false }] },
    ]
    for (const change of changes) {
      expect(isFormChanged(original, form(change)), JSON.stringify(change)).toBe(true)
    }
  })

  it('文字の前後の空白だけの違いは、変更と見なさない', () => {
    const padded = `  ${detail.title} `
    expect(isFormChanged(detailToForm(detail), form({ title: padded }))).toBe(false)
  })

  it('チェックリストは、チェックの付け外し・順番の入れ替えも、変更あり', () => {
    const withItems = {
      ...detail,
      checklist_items: [
        { name: '書類A', done: false },
        { name: '書類B', done: false },
      ],
    }
    const original = detailToForm(withItems)
    const checked = detailToForm(withItems)
    checked.checklist[0].done = true
    expect(isFormChanged(original, checked)).toBe(true)
    const swapped = detailToForm(withItems)
    swapped.checklist.reverse()
    expect(isFormChanged(original, swapped)).toBe(true)
  })

  it('新しい依頼は、何か入力すると変更あり', () => {
    const original = emptyForm(4, '2026-11-08')
    expect(isFormChanged(original, { ...emptyForm(4, '2026-11-08'), title: 'あ' })).toBe(true)
  })
})
