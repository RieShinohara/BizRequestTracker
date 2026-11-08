// @vitest-environment jsdom
// アクセシビリティ（読み上げソフトやキーボードで使えるか）の自動検査。axe-core を使う。
// 色のコントラストと、画面の配置、実際の聞こえ方は、jsdom では検査できない（test-utils/a11y.ts）
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { ApiError } from '../api'
import { a11yViolations, expectNoA11yViolations } from '../test-utils/a11y'
import { byTestId, click, flushPromises, mountWithVuetify, typeInto } from '../test-utils/mount'
import type { Category, CategoryWithCount, RequestDetail, RequestRow, Requester } from '../types'
import CategoryDialog from './CategoryDialog.vue'
import RequestDialog from './RequestDialog.vue'
import RequestTable from './RequestTable.vue'
import TemplateDialog from './TemplateDialog.vue'

// 通信（API）は、本物を呼ばず、決めた返事を返す代用品にする
vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  fetchRequest: vi.fn(),
  fetchRequesters: vi.fn(),
  fetchConfirmTargets: vi.fn(),
  fetchTemplateItems: vi.fn(),
  fetchCategories: vi.fn(),
  createCategory: vi.fn(),
  updateRequest: vi.fn(),
  saveTemplateItems: vi.fn(),
}))
import * as api from '../api'

const categories: Category[] = [
  { id: 4, name: '通関' },
  { id: 5, name: 'HP' },
]
const withCount: CategoryWithCount[] = [
  { id: 4, name: '通関', request_count: 2 },
  { id: 5, name: 'HP', request_count: 0 },
]
const requesters: Requester[] = [{ id: 2, name: '（架空）山田', extension: '1234' }]
// 画面に出る要素が多くなるよう、確認待ち・期限切れ・QMS・チェックリストありの依頼にする
const detail: RequestDetail = {
  id: 9,
  title: '（架空）通関書類の作成',
  requester: requesters[0],
  category: categories[0],
  status: '確認待ち',
  priority: '高',
  confirm_to: '薬事部',
  due_on: '2026-11-10',
  qms: true,
  archived: false,
  checklist_done: 1,
  checklist_total: 2,
  due_level: 'overdue',
  description: '説明',
  received_on: '2026-11-01',
  checklist_items: [
    { name: '書類A', done: true },
    { name: '書類B', done: false },
  ],
}
const row: RequestRow = {
  ...detail,
  requester: { id: 2, name: '（架空）山田' },
  category: categories[0],
}
const rows: RequestRow[] = [
  row,
  { ...row, id: 10, title: '（架空）HPの更新', status: '作業中', due_level: 'soon', qms: false },
  { ...row, id: 11, title: '（架空）古い依頼', archived: true, due_level: null, status: '完了' },
]

let wrapper: VueWrapper | null = null

beforeEach(() => {
  vi.mocked(api.fetchRequest).mockResolvedValue(detail)
  vi.mocked(api.fetchRequesters).mockResolvedValue(requesters)
  vi.mocked(api.fetchConfirmTargets).mockResolvedValue(['依頼者', '薬事部'])
  vi.mocked(api.fetchTemplateItems).mockResolvedValue(['項目1', '項目2'])
  vi.mocked(api.fetchCategories).mockResolvedValue(withCount)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

async function mount(
  component: Parameters<typeof mountWithVuetify>[0],
  props: Record<string, unknown>,
) {
  wrapper = mountWithVuetify(component, { props })
  await flushPromises()
  return wrapper
}

describe('検査の道具が、働いていること', () => {
  // 「いつも通る検査」は、ないのと同じ。わざと違反を入れて、検出できることを確かめる
  const Broken = defineComponent({
    render: () =>
      h('div', [
        h('button', { type: 'button' }), // 名前のないボタン
        h('input', { type: 'text' }), // ラベルのない入力欄
        h('img', { src: 'x.png' }), // 代わりの文字のない画像
      ]),
  })

  it('名前のないボタン・ラベルのない入力欄・代わりの文字のない画像を、見つける', async () => {
    wrapper = mountWithVuetify(Broken)
    const ids = (await a11yViolations()).map((violation) => violation.id)
    expect(ids).toEqual(expect.arrayContaining(['button-name', 'label', 'image-alt']))
  })

  it('違反があると、expectNoA11yViolations は、失敗して、違反の中身を出す', async () => {
    wrapper = mountWithVuetify(Broken)
    await expect(expectNoA11yViolations()).rejects.toThrow('button-name')
  })
})

describe('詳細モーダル', () => {
  const props = { requestId: 9, isNew: false, categories }

  it('依頼を開いたとき（確認待ち・チェックリストあり）', async () => {
    await mount(RequestDialog, props)
    await expectNoA11yViolations()
  })

  it('モーダルに名前がある（読み上げソフトが、何のモーダルか分かる）', async () => {
    await mount(RequestDialog, props)
    expect(document.body.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      '依頼の詳細',
    )
  })

  it('チェックリストの、チェックボックスに、項目の名前がある', async () => {
    await mount(RequestDialog, props)
    const labels = Array.from(
      document.body.querySelectorAll('[data-testid="checklist"] input[type="checkbox"]'),
    ).map((input) => input.getAttribute('aria-label'))
    expect(labels).toEqual(['書類A', '書類B'])
  })

  it('新しい依頼', async () => {
    await mount(RequestDialog, { requestId: null, isNew: true, categories })
    expect(document.body.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      '新しい依頼',
    )
    await expectNoA11yViolations()
  })

  it('保存に失敗して、エラーが出ているとき', async () => {
    vi.mocked(api.updateRequest).mockRejectedValue(new ApiError(404, '依頼が見つかりません', 'x'))
    await mount(RequestDialog, props)
    await typeInto('title', '別のタイトル')
    await click(byTestId('save'))
    expect(byTestId('dialog-error')).not.toBeNull()
    await expectNoA11yViolations()
  })

  it('アーカイブ中の依頼で、「完全に削除」の確認が出ているとき', async () => {
    vi.mocked(api.fetchRequest).mockResolvedValue({ ...detail, archived: true })
    await mount(RequestDialog, props)
    await click(byTestId('delete'))
    expect(document.body.textContent).toContain('完全に削除しますか？')
    await expectNoA11yViolations()
  })
})

describe('カテゴリー管理', () => {
  it('一覧が出ているとき', async () => {
    await mount(CategoryDialog, { open: true })
    expect(document.body.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'カテゴリー管理',
    )
    await expectNoA11yViolations()
  })

  it('名前を直している最中', async () => {
    await mount(CategoryDialog, { open: true })
    await click(document.body.querySelectorAll('[data-testid="category-rename"]')[0])
    expect(byTestId('category-edit-name')).not.toBeNull()
    await expectNoA11yViolations()
  })

  it('エラー（同じ名前）が出ているとき', async () => {
    vi.mocked(api.createCategory).mockRejectedValue(
      new ApiError(409, '同じ名前のカテゴリーがすでにあります', 'x'),
    )
    await mount(CategoryDialog, { open: true })
    await typeInto('category-new-name', 'HP')
    await click(byTestId('category-add'))
    expect(byTestId('category-error')).not.toBeNull()
    await expectNoA11yViolations()
  })

  it('削除の確認が出ているとき', async () => {
    await mount(CategoryDialog, { open: true })
    await click(document.body.querySelectorAll('[data-testid="category-delete"]')[1]) // 依頼 0 件の HP
    expect(document.body.textContent).toContain('カテゴリーを削除しますか？')
    await expectNoA11yViolations()
  })
})

describe('テンプレート編集', () => {
  it('項目が出ているとき', async () => {
    await mount(TemplateDialog, { category: { id: 4, name: '通関' } })
    expect(document.body.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'テンプレートの編集：通関',
    )
    await expectNoA11yViolations()
  })

  it('保存していない変更があるとき', async () => {
    await mount(TemplateDialog, { category: { id: 4, name: '通関' } })
    await typeInto('template-new', '新しい項目')
    expect(document.body.textContent).toContain('保存していない変更があります')
    await expectNoA11yViolations()
  })

  it('空の名前でエラーが出ているとき', async () => {
    await mount(TemplateDialog, { category: { id: 4, name: '通関' } })
    await typeInto('template-name', '')
    await click(byTestId('template-save'))
    expect(byTestId('template-error')).not.toBeNull()
    await expectNoA11yViolations()
  })
})

describe('一覧（RequestTable）', () => {
  const props = { rows, filtered: false, dragDisabledReason: null }

  it('依頼が並んでいるとき（確認待ち・期限切れ・3営業日以内・QMS・アーカイブ中を含む）', async () => {
    await mount(RequestTable, props)
    expect(document.body.querySelectorAll('[data-testid="row"]')).toHaveLength(3)
    await expectNoA11yViolations()
  })

  it('ステータスの札が、押せるボタンとして、読み上げソフトに伝わる', async () => {
    await mount(RequestTable, props)
    const chip = document.body.querySelector('[data-testid="status-chip"]')
    expect(chip?.getAttribute('role')).toBe('button')
    expect(chip?.getAttribute('aria-label')).toBe('ステータス：確認待ち（押して変更）')
  })

  it('ドラッグの取っ手の列に、見出しの文字がある', async () => {
    await mount(RequestTable, props)
    expect(document.body.querySelector('thead th')?.textContent).toContain('並びを変える取っ手')
  })

  it('期限の色（期限切れ・3営業日以内）が、読み上げ用の文字でも伝わる', async () => {
    await mount(RequestTable, props)
    const text = document.body.textContent ?? ''
    expect(text).toContain('（期限切れ）')
    expect(text).toContain('（3営業日以内）')
  })

  it('依頼のタイトルは、Tab で止まるボタン（F3）', async () => {
    await mount(RequestTable, props)
    const titles = document.body.querySelectorAll<HTMLButtonElement>('[data-testid="open-request"]')
    expect(Array.from(titles).map((button) => button.tagName)).toEqual([
      'BUTTON',
      'BUTTON',
      'BUTTON',
    ])
  })

  it('ドラッグできないとき（検索中など）', async () => {
    await mount(RequestTable, {
      ...props,
      dragDisabledReason: '手動の並びのときだけ、ドラッグできます',
    })
    await expectNoA11yViolations()
  })

  it('依頼が1件もないとき', async () => {
    await mount(RequestTable, { rows: [], filtered: true, dragDisabledReason: null })
    await expectNoA11yViolations()
  })

  it('確認先の入力が開いているとき（確認待ちの確認先を押した）', async () => {
    await mount(RequestTable, props)
    await click(document.body.querySelector('[data-testid="confirm-link"]'))
    expect(document.body.textContent).toContain('確認先を変更')
    expect(document.body.querySelectorAll('[role="dialog"]').length).toBeGreaterThan(0)
    await expectNoA11yViolations()
  })
})
