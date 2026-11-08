// @vitest-environment jsdom
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api'
import type { CategoryWithCount } from '../types'
import {
  allByTestId,
  byTestId,
  click,
  flushPromises,
  mountWithVuetify,
  typeInto,
} from '../test-utils/mount'
import CategoryDialog from './CategoryDialog.vue'

// 通信（API）は、本物を呼ばず、決めた返事を返す代用品にする。ApiError などは、本物を使う
vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  fetchCategories: vi.fn(),
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  deleteCategory: vi.fn(),
  fetchTemplateItems: vi.fn(),
  saveTemplateItems: vi.fn(),
}))
import * as api from '../api'

// HP と通関は、依頼が使っている（削除できない）。取扱説明書は、使っていない（削除できる）
const categories: CategoryWithCount[] = [
  { id: 7, name: 'HP', request_count: 5 },
  { id: 8, name: '通関', request_count: 2 },
  { id: 9, name: '取扱説明書', request_count: 0 },
]

let wrapper: VueWrapper | null = null

async function open() {
  wrapper = mountWithVuetify(CategoryDialog, { props: { open: true } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.mocked(api.fetchCategories).mockResolvedValue(categories)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

function names() {
  return allByTestId('category-name').map((element) => element.textContent?.trim())
}

describe('カテゴリー管理：一覧', () => {
  it('開くと、最新の一覧を取り、名前と、使っている依頼の数を出す', async () => {
    await open()
    expect(api.fetchCategories).toHaveBeenCalledTimes(1)
    expect(names()).toEqual(['HP', '通関', '取扱説明書'])
    const list = byTestId('category-list')?.textContent ?? ''
    expect(list).toContain('依頼 5件')
    expect(list).toContain('依頼 0件')
  })

  it('読み込めなかったときは、エラーを出す', async () => {
    vi.mocked(api.fetchCategories).mockRejectedValue(new Error('down'))
    await open()
    expect(byTestId('category-error')?.textContent).toContain('カテゴリーを読み込めませんでした')
  })
})

describe('カテゴリー管理：削除できるか', () => {
  it('依頼が使っているカテゴリーは、削除ボタンを押せない。使っていないものは、押せる', async () => {
    await open()
    const buttons = allByTestId<HTMLButtonElement>('category-delete')
    expect(buttons.map((button) => button.disabled)).toEqual([true, true, false])
  })

  it('押せないボタンには、理由（件数つき）が出る', async () => {
    await open()
    const reasons = allByTestId('category-delete').map(
      (button) => button.parentElement?.getAttribute('title') ?? '',
    )
    expect(reasons[0]).toBe('このカテゴリーを使っている依頼が5件あるため、削除できません')
    expect(reasons[2]).toBe('')
  })

  it('削除は、確認の画面を出してから。「やめる」なら、何も送らない', async () => {
    await open()
    await click(allByTestId('category-delete')[2])
    expect(document.body.textContent).toContain('カテゴリーを削除しますか？')
    expect(document.body.textContent).toContain('「取扱説明書」を削除します')
    await click(byTestId('category-delete-cancel'))
    expect(api.deleteCategory).not.toHaveBeenCalled()
  })

  it('確認で「削除する」を押すと、削除して、一覧を取り直し、changed を伝える', async () => {
    const w = await open()
    vi.mocked(api.deleteCategory).mockResolvedValue()
    vi.mocked(api.fetchCategories).mockResolvedValue(categories.slice(0, 2))
    await click(allByTestId('category-delete')[2])
    await click(byTestId('category-delete-confirm'))
    expect(api.deleteCategory).toHaveBeenCalledWith(9)
    expect(api.fetchCategories).toHaveBeenCalledTimes(2)
    expect(names()).toEqual(['HP', '通関'])
    expect(w.emitted('changed')).toHaveLength(1)
  })

  it('削除に失敗したら、API の理由を出し、changed は伝えない', async () => {
    const w = await open()
    vi.mocked(api.deleteCategory).mockRejectedValue(
      new ApiError(409, 'このカテゴリーを使っている依頼があるため、削除できません', 'x'),
    )
    await click(allByTestId('category-delete')[2])
    await click(byTestId('category-delete-confirm'))
    expect(byTestId('category-error')?.textContent).toContain('使っている依頼があるため')
    expect(w.emitted('changed')).toBeUndefined()
  })
})

describe('カテゴリー管理：追加', () => {
  it('名前を入れて「追加」を押すと、前後の空白を取って送り、一覧を取り直し、changed を伝える', async () => {
    const w = await open()
    vi.mocked(api.createCategory).mockResolvedValue({
      id: 10,
      name: '新しい業務',
      request_count: 0,
    })
    await typeInto('category-new-name', '  新しい業務  ')
    await click(byTestId('category-add'))
    expect(api.createCategory).toHaveBeenCalledWith('新しい業務')
    expect(api.fetchCategories).toHaveBeenCalledTimes(2)
    expect(w.emitted('changed')).toHaveLength(1)
    // 追加できたら、入力欄は空になる
    expect(
      document.body.querySelector<HTMLInputElement>('[data-testid="category-new-name"] input')
        ?.value,
    ).toBe('')
  })

  it('空の名前は、API を呼ばず、メッセージを出す', async () => {
    const w = await open()
    await typeInto('category-new-name', '   ')
    await click(byTestId('category-add'))
    expect(api.createCategory).not.toHaveBeenCalled()
    expect(byTestId('category-error')?.textContent).toContain('カテゴリー名を入力してください')
    expect(w.emitted('changed')).toBeUndefined()
  })

  it('同じ名前（409）なら、API の理由を出し、入力は残し、changed は伝えない', async () => {
    const w = await open()
    vi.mocked(api.createCategory).mockRejectedValue(
      new ApiError(409, '同じ名前のカテゴリーがすでにあります', 'x'),
    )
    await typeInto('category-new-name', 'HP')
    await click(byTestId('category-add'))
    expect(byTestId('category-error')?.textContent).toContain(
      '同じ名前のカテゴリーがすでにあります',
    )
    expect(
      document.body.querySelector<HTMLInputElement>('[data-testid="category-new-name"] input')
        ?.value,
    ).toBe('HP')
    expect(w.emitted('changed')).toBeUndefined()
  })
})

describe('カテゴリー管理：名前の変更', () => {
  it('鉛筆を押すと、入力欄に変わり、保存すると、新しい名前を送って、changed を伝える', async () => {
    const w = await open()
    vi.mocked(api.renameCategory).mockResolvedValue({
      id: 8,
      name: '通関書類',
      request_count: 2,
    })
    await click(allByTestId('category-rename')[1])
    await typeInto('category-edit-name', '通関書類')
    await click(byTestId('category-rename-save'))
    expect(api.renameCategory).toHaveBeenCalledWith(8, '通関書類')
    expect(w.emitted('changed')).toHaveLength(1)
    // 保存できたら、入力欄は消える
    expect(byTestId('category-edit-name')).toBeNull()
  })

  it('同じ名前（409）なら、API の理由を出し、入力欄は開いたまま', async () => {
    await open()
    vi.mocked(api.renameCategory).mockRejectedValue(
      new ApiError(409, '同じ名前のカテゴリーがすでにあります', 'x'),
    )
    await click(allByTestId('category-rename')[1])
    await typeInto('category-edit-name', 'HP')
    await click(byTestId('category-rename-save'))
    expect(byTestId('category-error')?.textContent).toContain(
      '同じ名前のカテゴリーがすでにあります',
    )
    expect(byTestId('category-edit-name')).not.toBeNull()
  })

  it('空の名前にして保存しようとすると、API を呼ばず、メッセージを出す', async () => {
    await open()
    await click(allByTestId('category-rename')[1])
    await typeInto('category-edit-name', '')
    await click(byTestId('category-rename-save'))
    expect(api.renameCategory).not.toHaveBeenCalled()
    expect(byTestId('category-error')?.textContent).toContain('カテゴリー名を入力してください')
  })
})
