/** API を呼ぶ部品。画面からは、ここを通して API を呼ぶ。 */
import type {
  Category,
  RequestPatch,
  RequestQuery,
  RequestDetail,
  Requester,
  RequestRow,
  StatusChange,
  Summary,
} from './types'

/** API が起きているか確かめる（GET /health）。つながれば true。 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch('/health')
    if (!response.ok) return false
    const body: { status?: string } = await response.json()
    return body.status === 'ok'
  } catch {
    // API が止まっている、ネットワークが切れている、など
    return false
  }
}

/** JSON を取ってくる。失敗（つながらない・エラーの番号）したら、例外を投げる。 */
async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`API がエラーを返しました（${response.status}）：${url}`)
  }
  return (await response.json()) as T
}

/**
 * 一覧を取る URL を作る。条件が空のものは付けない（API の「省略」と同じ意味になる）。
 * 検索の文字は、URLSearchParams が、日本語や記号を安全な形に直してくれる。
 */
export function buildRequestsUrl(query: Partial<RequestQuery> = {}): string {
  const params = new URLSearchParams()
  const q = query.q?.trim()
  if (q) params.set('q', q)
  if (query.qms) params.set('qms', 'true')
  if (query.categoryId != null) params.set('category_id', String(query.categoryId))
  if (query.status) params.set('status', query.status)
  if (query.sort) params.set('sort', query.sort)
  if (query.includeArchived) params.set('include_archived', 'true')
  const text = params.toString()
  return text ? `/api/requests?${text}` : '/api/requests'
}

/** 依頼の一覧（GET /api/requests）。条件は、すべて省略できる。 */
export function fetchRequests(query: Partial<RequestQuery> = {}): Promise<RequestRow[]> {
  return getJson<RequestRow[]>(buildRequestsUrl(query))
}

/** 業務カテゴリーの一覧（GET /api/categories） */
export function fetchCategories(): Promise<Category[]> {
  return getJson<Category[]>('/api/categories')
}

/** 確認先の候補（GET /api/confirm-targets）。過去に入力した確認先も含まれる */
export function fetchConfirmTargets(): Promise<string[]> {
  return getJson<string[]>('/api/confirm-targets')
}

/**
 * ステータス変更の指示を、API に送る形にする。確認先の空の文字は、null（未入力）にする。
 * 確認先を指定しない変更（例：完了にする）では、confirm_to を送らない（以前の確認先を消さない）。
 */
export function statusChangeToPatch(change: StatusChange): RequestPatch {
  const patch: RequestPatch = { status: change.status }
  if (change.confirmTo !== undefined) {
    patch.confirm_to = change.confirmTo?.trim() || null
  }
  return patch
}

/**
 * 依頼の更新（PATCH /api/requests/{id}）。送った項目だけが変わる。
 * 失敗（つながらない・エラーの番号）したら、例外を投げる。
 */
export async function updateRequest(id: number, patch: RequestPatch): Promise<void> {
  const response = await fetch(`/api/requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!response.ok) {
    throw new Error(`API がエラーを返しました（${response.status}）：PATCH /api/requests/${id}`)
  }
}

/** 依頼1件（GET /api/requests/{id}）。詳細モーダル用 */
export function fetchRequest(id: number): Promise<RequestDetail> {
  return getJson<RequestDetail>(`/api/requests/${id}`)
}

/** 依頼者の一覧（GET /api/requesters）。名前順 */
export function fetchRequesters(): Promise<Requester[]> {
  return getJson<Requester[]>('/api/requesters')
}

/** 本文つきで送る（POST・PATCH）。失敗したら、例外を投げる。成功したら、返ってきた JSON を返す。 */
async function sendJson<T>(method: 'POST' | 'PATCH', url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`API がエラーを返しました（${response.status}）：${method} ${url}`)
  }
  return (await response.json()) as T
}

/** 依頼者の登録（POST /api/requesters）。同じ名前がすでにあると、失敗する（409）。 */
export function createRequester(name: string, extension: string): Promise<Requester> {
  return sendJson<Requester>('POST', '/api/requesters', { name, extension })
}

/** 依頼者の内線番号の変更（PATCH /api/requesters/{id}）。その人の他の依頼にも反映される。 */
export async function updateRequesterExtension(id: number, extension: string): Promise<void> {
  await sendJson<Requester>('PATCH', `/api/requesters/${id}`, { extension })
}

/** 画面上部の件数（GET /api/summary） */
export function fetchSummary(): Promise<Summary> {
  return getJson<Summary>('/api/summary')
}
