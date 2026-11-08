// @vitest-environment jsdom
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api'
import type { Category, RequestDetail, Requester } from '../types'
import { byTestId, click, flushPromises, mountWithVuetify, typeInto } from '../test-utils/mount'
import RequestDialog from './RequestDialog.vue'

// 通信（API）は、本物を呼ばず、決めた返事を返す代用品にする。ApiError などは、本物を使う
vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  fetchRequest: vi.fn(),
  fetchRequesters: vi.fn(),
  fetchConfirmTargets: vi.fn(),
  fetchTemplateItems: vi.fn(),
  createRequest: vi.fn(),
  updateRequest: vi.fn(),
  deleteRequest: vi.fn(),
  createRequester: vi.fn(),
  updateRequesterExtension: vi.fn(),
}))
import * as api from '../api'

const categories: Category[] = [
  { id: 4, name: '通関' },
  { id: 5, name: 'HP' },
]
const requesters: Requester[] = [
  { id: 2, name: '（架空）山田', extension: '1234' },
  { id: 3, name: '（架空）佐藤', extension: null },
]
const detail: RequestDetail = {
  id: 9,
  title: '（架空）通関書類の作成',
  requester: requesters[0],
  category: categories[0],
  status: '作業中',
  priority: '高',
  confirm_to: null,
  due_on: '2026-11-10',
  qms: false,
  archived: false,
  checklist_done: 0,
  checklist_total: 1,
  due_level: null,
  description: null,
  received_on: '2026-11-01',
  checklist_items: [{ name: '書類A', done: false }],
}

let wrapper: VueWrapper | null = null

/** 詳細モーダルを、依頼 9 番を開いた状態で描く（読み込みが終わるまで待つ） */
async function openExisting() {
  wrapper = mountWithVuetify(RequestDialog, {
    props: { requestId: 9, isNew: false, categories },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.mocked(api.fetchRequest).mockResolvedValue(detail)
  vi.mocked(api.fetchRequesters).mockResolvedValue(requesters)
  vi.mocked(api.fetchConfirmTargets).mockResolvedValue(['依頼者', '薬事部'])
  vi.mocked(api.updateRequest).mockResolvedValue()
  vi.mocked(api.createRequest).mockResolvedValue(detail)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

/**
 * 依頼者の欄（v-combobox）で、名前が選ばれたことにする。v-combobox は、文字を打っただけでは値が決まらず
 * （Enter・フォーカスが外れたときに決まる）、jsdom では、その動きを再現しにくいので、部品に、直接伝える。
 */
async function chooseRequester(w: VueWrapper, name: string) {
  const requesterCombobox = w.findAllComponents({ name: 'VCombobox' })[0] // 1つ目が、依頼者
  requesterCombobox.vm.$emit('update:modelValue', name)
  await flushPromises()
}

function titleInput() {
  return document.body.querySelector<HTMLInputElement>('[data-testid="title"] input')
}

function closeButtonText() {
  return byTestId('close')?.textContent?.trim()
}

describe('詳細モーダル：開く', () => {
  it('依頼の内容を取ってきて、入力欄に出す', async () => {
    await openExisting()
    expect(api.fetchRequest).toHaveBeenCalledWith(9)
    expect(titleInput()?.value).toBe('（架空）通関書類の作成')
    expect(document.body.textContent).toContain('書類A') // チェックリスト
  })

  it('読み込めなかったときは、エラーを出す（入力欄は出さない）', async () => {
    vi.mocked(api.fetchRequest).mockRejectedValue(new ApiError(404, '依頼が見つかりません', 'x'))
    await openExisting()
    expect(byTestId('dialog-load-error')?.textContent).toContain('依頼を読み込めませんでした')
    expect(titleInput()).toBeNull()
  })
})

describe('詳細モーダル：変更中の閉じる確認（F2）', () => {
  it('何も変えていなければ、「閉じる」で、閉じる（close を伝える）。閉じない設定にもなっていない', async () => {
    const w = await openExisting()
    expect(byTestId('dirty-note')).toBeNull()
    expect(closeButtonText()).toBe('閉じる')
    expect(w.findComponent({ name: 'VDialog' }).props('persistent')).toBe(false)
    await click(byTestId('close'))
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('タイトルを変えると、「保存していない変更があります」と出て、外側・Esc では閉じない設定になる', async () => {
    const w = await openExisting()
    await typeInto('title', '別のタイトル')
    expect(byTestId('dirty-note')?.textContent).toContain('保存していない変更があります')
    expect(closeButtonText()).toBe('変更を捨てて閉じる')
    expect(w.findComponent({ name: 'VDialog' }).props('persistent')).toBe(true)
  })

  it('「変更を捨てて閉じる」で、閉じられる', async () => {
    const w = await openExisting()
    await typeInto('title', '別のタイトル')
    await click(byTestId('close'))
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('変更を元に戻すと、変更なしに戻る', async () => {
    const w = await openExisting()
    await typeInto('title', '別のタイトル')
    expect(byTestId('dirty-note')).not.toBeNull()
    await typeInto('title', '（架空）通関書類の作成')
    expect(byTestId('dirty-note')).toBeNull()
    expect(w.findComponent({ name: 'VDialog' }).props('persistent')).toBe(false)
  })
})

describe('詳細モーダル：保存', () => {
  it('変えた内容を、PATCH で送り、saved を伝える', async () => {
    const w = await openExisting()
    await typeInto('title', '  別のタイトル  ')
    await click(byTestId('save'))
    expect(api.updateRequest).toHaveBeenCalledTimes(1)
    const [id, patch] = vi.mocked(api.updateRequest).mock.calls[0]
    expect(id).toBe(9)
    expect(patch).toMatchObject({ title: '別のタイトル', requester_id: 2, category_id: 4 })
    expect(w.emitted('saved')).toHaveLength(1)
  })

  it('必須（タイトル）が空なら、API を呼ばず、メッセージを出す', async () => {
    const w = await openExisting()
    await typeInto('title', '   ')
    await click(byTestId('save'))
    expect(api.updateRequest).not.toHaveBeenCalled()
    expect(byTestId('dialog-error')?.textContent).toContain('タイトル、依頼者、期限日は必須です')
    expect(w.emitted('saved')).toBeUndefined()
  })

  it('文字数が上限を超えていたら、API を呼ばず、上限を知らせる（F1）', async () => {
    await openExisting()
    await typeInto('title', 'あ'.repeat(201))
    await click(byTestId('save'))
    expect(api.updateRequest).not.toHaveBeenCalled()
    expect(byTestId('dialog-error')?.textContent).toContain('タイトルは200文字までです')
  })

  it('保存に失敗したら、API の理由を出し、saved は伝えない（F1）', async () => {
    vi.mocked(api.updateRequest).mockRejectedValue(new ApiError(404, '依頼が見つかりません', 'x'))
    const w = await openExisting()
    await typeInto('title', '別のタイトル')
    await click(byTestId('save'))
    expect(byTestId('dialog-error')?.textContent).toContain('依頼が見つかりません')
    expect(w.emitted('saved')).toBeUndefined()
  })

  it('理由が読み取れない失敗（つながらない、など）は、これまでの文を出す', async () => {
    vi.mocked(api.updateRequest).mockRejectedValue(new TypeError('Failed to fetch'))
    await openExisting()
    await typeInto('title', '別のタイトル')
    await click(byTestId('save'))
    expect(byTestId('dialog-error')?.textContent).toContain('保存できませんでした')
  })
})

describe('詳細モーダル：新しい依頼', () => {
  async function openNew() {
    wrapper = mountWithVuetify(RequestDialog, {
      props: { requestId: null, isNew: true, categories },
    })
    await flushPromises()
    return wrapper
  }

  it('何も入力していなければ、閉じる確認は出ない。入力すると、出る', async () => {
    const w = await openNew()
    expect(byTestId('dirty-note')).toBeNull()
    expect(w.findComponent({ name: 'VDialog' }).props('persistent')).toBe(false)
    await typeInto('title', 'あ')
    expect(byTestId('dirty-note')).not.toBeNull()
    expect(w.findComponent({ name: 'VDialog' }).props('persistent')).toBe(true)
  })

  it('必須を入れて保存すると、POST で送る（登録済みの依頼者は、新しく作らない）', async () => {
    const w = await openNew()
    await typeInto('title', '新しい依頼')
    await chooseRequester(w, '（架空）山田')
    await typeInto('due-on', '2026-11-20')
    await click(byTestId('save'))
    expect(api.createRequest).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.createRequest).mock.calls[0][0]).toMatchObject({
      title: '新しい依頼',
      requester_id: 2,
      category_id: 4,
      due_on: '2026-11-20',
    })
    expect(api.createRequester).not.toHaveBeenCalled()
    expect(w.emitted('saved')).toHaveLength(1)
  })
})
