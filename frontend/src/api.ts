/** API を呼ぶ部品。画面からは、ここを通して API を呼ぶ。 */

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
