/** API とやり取りするデータの型（docs/api-design.md のとおり）。 */

export const STATUSES = ['未着手', '作業中', '確認待ち', '完了', 'ペンディング'] as const
export const PRIORITIES = ['急ぎ', '高', '中', '低'] as const

export type Status = (typeof STATUSES)[number]
export type Priority = (typeof PRIORITIES)[number]

/** 期限の色：overdue＝期限切れ（赤）、soon＝3営業日以内（オレンジ）、null＝色なし */
export type DueLevel = 'overdue' | 'soon' | null

/** 一覧の1件（GET /api/requests） */
export interface RequestRow {
  id: number
  title: string
  requester: { id: number; name: string }
  category: { id: number; name: string }
  status: Status
  priority: Priority
  confirm_to: string | null
  due_on: string // YYYY-MM-DD
  qms: boolean
  archived: boolean
  checklist_done: number
  checklist_total: number
  due_level: DueLevel
}

/** 並び替えの見せ方。null＝手動の並び */
export type SortKey = 'priority' | 'due_on' | 'status' | null

/** 検索・絞り込み・並び替えの条件（一覧の取得に使う） */
export interface RequestQuery {
  q: string
  qms: boolean
  categoryId: number | null
  status: Status | null
  sort: SortKey
  includeArchived: boolean
}

/** 業務カテゴリー（GET /api/categories）。絞り込みの選択肢に使う */
export interface Category {
  id: number
  name: string
}

/** 依頼の更新で送る項目（PATCH /api/requests/{id}）。送った項目だけが変わる */
export interface RequestPatch {
  title?: string
  description?: string | null
  requester_id?: number
  category_id?: number
  received_on?: string
  due_on?: string
  status?: Status
  priority?: Priority
  confirm_to?: string | null
  qms?: boolean
  archived?: boolean
  checklist_items?: ChecklistItem[]
}

/** 依頼者（GET /api/requesters）。内線番号は、先頭の 0 を守るため、文字で扱う */
export interface Requester {
  id: number
  name: string
  extension: string | null
}

/** チェックリストの1項目 */
export interface ChecklistItem {
  name: string
  done: boolean
}

/** 依頼1件（GET /api/requests/{id}）。詳細モーダル用。一覧の項目に、詳しい項目が加わる */
export interface RequestDetail extends Omit<RequestRow, 'requester'> {
  requester: Requester
  description: string | null
  received_on: string // YYYY-MM-DD
  checklist_items: ChecklistItem[]
}

/** 一覧からのステータス変更の指示。確認先は、「確認待ち」にするときだけ付く */
export interface StatusChange {
  id: number
  status: Status
  confirmTo?: string | null
}

/** 画面上部の件数（GET /api/summary） */
export interface Summary {
  status_counts: Record<Status, number>
  urgent_count: number
}
