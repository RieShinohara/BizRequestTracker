export const STATUSES = ['未着手', '作業中', '確認待ち', '完了', 'ペンディング'] as const
export const PRIORITIES = ['急ぎ', '高', '中', '低'] as const

export type Status = (typeof STATUSES)[number]
export type Priority = (typeof PRIORITIES)[number]

export interface Requester {
  id: number
  name: string
  extension: string // 内線番号（空でもよい）
}

export interface Category {
  id: number
  name: string
}

export interface TemplateItem {
  categoryId: number
  name: string
}

export interface ChecklistItem {
  id: number
  name: string
  done: boolean
}

export interface Request {
  id: number
  title: string
  description: string
  requesterId: number
  categoryId: number
  receivedOn: string // YYYY-MM-DD
  dueOn: string // YYYY-MM-DD
  status: Status
  priority: Priority
  confirmTo: string
  qms: boolean
  archived: boolean
  checklist: ChecklistItem[]
}
