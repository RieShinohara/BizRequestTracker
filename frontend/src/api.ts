/** API を呼ぶ部品。画面からは、ここを通して API を呼ぶ。 */
import type {
  CategoryWithCount,
  RequestPatch,
  RequestQuery,
  RequestDetail,
  Requester,
  RequestRow,
  StatusChange,
  Summary,
} from './types'

// ---- 通信の共通の部分（すべての API 呼び出しが、ここを通る） ----

/**
 * API のエラー。status＝HTTP の番号、detail＝API が返した理由（日本語。{"detail": "..."} の中身）。
 * 理由が読み取れないとき（JSON でない、入力の検査の 422 は配列、など）は、detail は null。
 * つながらない（ネットワークの失敗）ときは、ApiError ではなく、fetch が投げる例外のまま。
 */
export class ApiError extends Error {
  status: number
  detail: string | null

  constructor(status: number, detail: string | null, message: string) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

/**
 * 失敗したときに、画面に出す文。API が理由（日本語）を返していれば、それを使う
 * （例：同じ名前がすでにある、アーカイブ中の依頼だけ削除できる）。読み取れなければ、操作ごとの文を使う。
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.detail) return error.detail
  return fallback
}

/** 失敗した返事から、ApiError を作る（理由が、文字で読み取れたときだけ detail に入れる） */
async function toApiError(response: Response, label: string): Promise<ApiError> {
  let detail: string | null = null
  try {
    const body: { detail?: unknown } = await response.json()
    if (typeof body.detail === 'string') detail = body.detail
  } catch {
    // 返事が JSON でなくても、番号だけで ApiError にする
  }
  return new ApiError(
    response.status,
    detail,
    `API がエラーを返しました（${response.status}）：${label}`,
  )
}

/** JSON を取ってくる（GET）。失敗（エラーの番号）したら、理由つきの ApiError を投げる。 */
async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw await toApiError(response, url)
  return (await response.json()) as T
}

/** 送る（POST・PUT・PATCH・DELETE）。本文があれば JSON で送る。失敗したら、理由つきの ApiError を投げる。 */
async function send(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  body?: unknown,
): Promise<Response> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) throw await toApiError(response, `${method} ${url}`)
  return response
}

/** 送って、返ってきた JSON を受け取る（返事に本文があるとき）。 */
async function sendJson<T>(
  method: 'POST' | 'PUT' | 'PATCH',
  url: string,
  body: unknown,
): Promise<T> {
  return (await (await send(method, url, body)).json()) as T
}

// ---- 動作確認 ----

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

// ---- 依頼 ----

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

/** 依頼1件（GET /api/requests/{id}）。詳細モーダル用 */
export function fetchRequest(id: number): Promise<RequestDetail> {
  return getJson<RequestDetail>(`/api/requests/${id}`)
}

/**
 * 依頼の追加（POST /api/requests）。必須は、title・requester_id・category_id・due_on。
 * 新しい依頼は、手動の並びのいちばん上に入る。失敗したら、理由つきの ApiError を投げる。
 */
export function createRequest(body: RequestPatch): Promise<RequestDetail> {
  return sendJson<RequestDetail>('POST', '/api/requests', body)
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
 * 失敗（エラーの番号）したら、理由つきの ApiError を投げる。
 */
export async function updateRequest(id: number, patch: RequestPatch): Promise<void> {
  await send('PATCH', `/api/requests/${id}`, patch)
}

/**
 * 依頼の完全な削除（DELETE /api/requests/{id}）。チェックリストも一緒に消える。元に戻せない。
 * アーカイブ中の依頼だけ消せる（そうでないと 409）。失敗したら、理由つきの ApiError を投げる。
 */
export async function deleteRequest(id: number): Promise<void> {
  await send('DELETE', `/api/requests/${id}`)
}

/**
 * 手動の並びの保存（PUT /api/requests/order）。送った順に、並びを振り直す。
 * ids は、アーカイブ中を除く全依頼の番号。過不足があるとき（別の画面で依頼が増減したなど）は
 * 409 になり、ApiError を投げる。
 */
export async function saveOrder(ids: number[]): Promise<void> {
  await send('PUT', '/api/requests/order', { ids })
}

/** 画面上部の件数（GET /api/summary） */
export function fetchSummary(): Promise<Summary> {
  return getJson<Summary>('/api/summary')
}

/** 確認先の候補（GET /api/confirm-targets）。過去に入力した確認先も含まれる */
export function fetchConfirmTargets(): Promise<string[]> {
  return getJson<string[]>('/api/confirm-targets')
}

// ---- 依頼者 ----

/** 依頼者の一覧（GET /api/requesters）。名前順 */
export function fetchRequesters(): Promise<Requester[]> {
  return getJson<Requester[]>('/api/requesters')
}

/** 依頼者の登録（POST /api/requesters）。同じ名前がすでにあると、失敗する（409）。 */
export function createRequester(name: string, extension: string): Promise<Requester> {
  return sendJson<Requester>('POST', '/api/requesters', { name, extension })
}

/** 依頼者の内線番号の変更（PATCH /api/requesters/{id}）。その人の他の依頼にも反映される。 */
export async function updateRequesterExtension(id: number, extension: string): Promise<void> {
  await sendJson<Requester>('PATCH', `/api/requesters/${id}`, { extension })
}

// ---- カテゴリーとテンプレート ----

/** 業務カテゴリーの一覧（GET /api/categories）。使っている依頼の数（request_count）つき */
export function fetchCategories(): Promise<CategoryWithCount[]> {
  return getJson<CategoryWithCount[]>('/api/categories')
}

/** カテゴリーの追加（POST /api/categories）。同じ名前があると、409 の ApiError */
export function createCategory(name: string): Promise<CategoryWithCount> {
  return sendJson<CategoryWithCount>('POST', '/api/categories', { name })
}

/** カテゴリーの名前の変更（PATCH /api/categories/{id}）。同じ名前があると、409 の ApiError */
export function renameCategory(id: number, name: string): Promise<CategoryWithCount> {
  return sendJson<CategoryWithCount>('PATCH', `/api/categories/${id}`, { name })
}

/** カテゴリーの削除（DELETE /api/categories/{id}）。依頼が使っていると、409 の ApiError */
export async function deleteCategory(id: number): Promise<void> {
  await send('DELETE', `/api/categories/${id}`)
}

/** カテゴリーのテンプレートの項目名（GET /api/categories/{id}/template-items）。テンプレートの順番どおり */
export async function fetchTemplateItems(categoryId: number): Promise<string[]> {
  const items = await getJson<{ name: string }[]>(`/api/categories/${categoryId}/template-items`)
  return items.map((item) => item.name)
}

/**
 * テンプレートの保存（PUT /api/categories/{id}/template-items）。送った一覧が、そのままテンプレートになる
 * （追加・編集・削除を、一度に反映する）。順番は、送った順。失敗したら、理由つきの ApiError を投げる。
 */
export async function saveTemplateItems(categoryId: number, names: string[]): Promise<string[]> {
  const items = await sendJson<{ name: string }[]>(
    'PUT',
    `/api/categories/${categoryId}/template-items`,
    { items: names.map((name) => ({ name })) },
  )
  return items.map((item) => item.name)
}
