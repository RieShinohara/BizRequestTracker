/** API を呼ぶ部品。画面からは、ここを通して API を呼ぶ。 */
import type { RequestRow, Summary } from './types'

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

/** 依頼の一覧（GET /api/requests）。アーカイブ中は、includeArchived が true のときだけ含む。 */
export function fetchRequests(options: { includeArchived?: boolean } = {}): Promise<RequestRow[]> {
  const query = options.includeArchived ? '?include_archived=true' : ''
  return getJson<RequestRow[]>(`/api/requests${query}`)
}

/** 画面上部の件数（GET /api/summary） */
export function fetchSummary(): Promise<Summary> {
  return getJson<Summary>('/api/summary')
}
