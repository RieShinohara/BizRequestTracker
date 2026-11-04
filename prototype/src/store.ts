import { reactive } from 'vue'
import { categories, initialRequests, requesters, templateItems, checklistFromTemplate } from './mockData'
import { todayIso } from './dates'
import type { Priority, Request, Status } from './types'

// プロトタイプ用の入れ物。ブラウザを開き直すと、仮データに戻る（DBには保存しない）。
export const state = reactive({
  requests: [...initialRequests],
  requesters: [...requesters],
  categories: [...categories],
  templateItems: [...templateItems],
})

let nextRequestId = 1000
let nextRequesterId = 1000
let nextChecklistId = 100000

export function requesterOf(id: number) {
  return state.requesters.find((r) => r.id === id)
}

export function categoryName(id: number) {
  return state.categories.find((c) => c.id === id)?.name ?? ''
}

/** 画面で入力された名前から、依頼者を探す。いなければ新しく登録する */
export function findOrCreateRequester(name: string, extension: string) {
  const trimmed = name.trim()
  let r = state.requesters.find((x) => x.name === trimmed)
  if (!r) {
    r = { id: nextRequesterId++, name: trimmed, extension: '' }
    state.requesters.push(r)
  }
  r.extension = extension.trim()
  return r
}

export function newRequestDraft(): Request {
  return {
    id: 0,
    title: '',
    description: '',
    requesterId: 0,
    categoryId: state.categories[0]?.id ?? 0,
    receivedOn: todayIso(),
    dueOn: '',
    status: '未着手' as Status,
    priority: '中' as Priority,
    confirmTo: '',
    qms: false,
    archived: false,
    checklist: [],
  }
}

/** 新しい依頼は、一番上に入る */
export function addRequest(r: Request) {
  state.requests.unshift({ ...r, id: nextRequestId++ })
}

export function updateRequest(r: Request) {
  const i = state.requests.findIndex((x) => x.id === r.id)
  if (i >= 0) state.requests[i] = r
}

export function deleteRequest(id: number) {
  state.requests = state.requests.filter((r) => r.id !== id)
}

/** テンプレートをコピーして、チェックリストに入れる（すでにある項目は残して、後ろに足す） */
export function templateChecklist(categoryId: number) {
  return checklistFromTemplate(categoryId).map((c) => ({ ...c, id: nextChecklistId++ }))
}

export function confirmToSuggestions(): string[] {
  const set = new Set(['依頼者', '薬事部', '開発部', '営業部', '工場'])
  state.requests.forEach((r) => r.confirmTo && set.add(r.confirmTo))
  return [...set]
}

export function newChecklistId() {
  return nextChecklistId++
}
