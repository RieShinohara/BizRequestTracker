/** 詳細モーダルの入力内容（フォーム）の扱い。画面の部品から切り離して、テストしやすくする。 */
import { createRequester, updateRequesterExtension } from './api'
import type { Priority, RequestDetail, RequestPatch, Requester, Status } from './types'

export const REQUIRED_MESSAGE = 'タイトル、依頼者、期限日は必須です'

/** 入力欄の中身。日付は YYYY-MM-DD の文字（<input type="date"> と同じ形） */
export interface RequestForm {
  title: string
  status: Status
  priority: Priority
  description: string
  requesterName: string
  requesterExtension: string
  categoryId: number
  confirmTo: string
  receivedOn: string
  dueOn: string
  qms: boolean
}

/** API から取った依頼1件を、入力欄の中身にする（null は、空の文字にする）。 */
export function detailToForm(detail: RequestDetail): RequestForm {
  return {
    title: detail.title,
    status: detail.status,
    priority: detail.priority,
    description: detail.description ?? '',
    requesterName: detail.requester.name,
    requesterExtension: detail.requester.extension ?? '',
    categoryId: detail.category.id,
    confirmTo: detail.confirm_to ?? '',
    receivedOn: detail.received_on,
    dueOn: detail.due_on,
    qms: detail.qms,
  }
}

/** 必須の項目（タイトル・依頼者・期限日）が入っているか調べる。問題があれば、メッセージを返す。 */
export function validateForm(form: RequestForm): string | null {
  if (!form.title.trim() || !form.requesterName.trim() || !form.dueOn) return REQUIRED_MESSAGE
  return null
}

/**
 * 入力内容を、API に送る形（PATCH）にする。
 * - 確認先は、ステータスが「確認待ち」のときだけ送る（それ以外では入力欄が使えず、残っている値を消さない）
 * - 空の詳細は null、受付日が空なら送らない（API は、受付日を空にできない）
 */
export function formToPatch(form: RequestForm, requesterId: number): RequestPatch {
  const patch: RequestPatch = {
    title: form.title.trim(),
    description: form.description.trim() || null,
    requester_id: requesterId,
    category_id: form.categoryId,
    due_on: form.dueOn,
    status: form.status,
    priority: form.priority,
    qms: form.qms,
  }
  if (form.receivedOn) patch.received_on = form.receivedOn
  if (form.status === '確認待ち') patch.confirm_to = form.confirmTo.trim() || null
  return patch
}

/**
 * 入力された依頼者の名前から、依頼者の番号を決める。
 * - 登録済みの名前 → その人の番号。内線番号が変わっていたら、その人の内線番号を直す
 * - 新しい名前 → 登録して、その番号
 */
export async function resolveRequesterId(
  form: Pick<RequestForm, 'requesterName' | 'requesterExtension'>,
  requesters: Requester[],
): Promise<number> {
  const name = form.requesterName.trim()
  const extension = form.requesterExtension.trim()
  const found = requesters.find((requester) => requester.name === name)
  if (!found) {
    return (await createRequester(name, extension)).id
  }
  if (extension !== (found.extension ?? '')) {
    await updateRequesterExtension(found.id, extension)
  }
  return found.id
}
