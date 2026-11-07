/** API を呼ぶ部品。画面からは、ここを通して API を呼ぶ。 */
import type { Category, RequestQuery, RequestRow, Summary } from './types'

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

/** 画面上部の件数（GET /api/summary） */
export function fetchSummary(): Promise<Summary> {
  return getJson<Summary>('/api/summary')
}
