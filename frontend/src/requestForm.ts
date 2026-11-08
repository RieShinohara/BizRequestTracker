/** 詳細モーダルの入力内容（フォーム）の扱い。画面の部品から切り離して、テストしやすくする。 */
import { createRequester, updateRequesterExtension } from './api'
import { sameChecklist } from './checklist'
import type {
  ChecklistItem,
  Priority,
  RequestDetail,
  RequestPatch,
  Requester,
  Status,
} from './types'

export const REQUIRED_MESSAGE = 'タイトル、依頼者、期限日は必須です'
export const CATEGORY_MESSAGE = 'カテゴリーを選んでください'

/** 入力欄の中身。日付は YYYY-MM-DD の文字（<input type="date"> と同じ形） */
export interface RequestForm {
  title: string
  status: Status
  priority: Priority
  description: string
  requesterName: string
  requesterExtension: string
  categoryId: number | null // null＝未選択（カテゴリーが1つもないとき）
  confirmTo: string
  receivedOn: string
  dueOn: string
  qms: boolean
  checklist: ChecklistItem[]
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
    checklist: detail.checklist_items.map((item) => ({ ...item })), // 画面で直しても、元の値を変えない
  }
}

/** 必須の項目（タイトル・依頼者・期限日・カテゴリー）が入っているか調べる。問題があれば、メッセージを返す。 */
export function validateForm(form: RequestForm): string | null {
  if (!form.title.trim() || !form.requesterName.trim() || !form.dueOn) return REQUIRED_MESSAGE
  if (form.categoryId === null) return CATEGORY_MESSAGE
  return null
}

/**
 * 入力内容を、API に送る形（PATCH）にする。
 * - 確認先は、ステータスが「確認待ち」のときだけ送る（それ以外では入力欄が使えず、残っている値を消さない）
 * - 空の詳細は null、受付日が空なら送らない（API は、受付日を空にできない）
 * - originalChecklist＝開いたときのチェックリスト（新しい依頼は、空）。変わっているときだけ、送る
 */
export function formToPatch(
  form: RequestForm,
  requesterId: number,
  originalChecklist: ChecklistItem[] = [],
): RequestPatch {
  const patch: RequestPatch = {
    title: form.title.trim(),
    description: form.description.trim() || null,
    requester_id: requesterId,
    category_id: form.categoryId ?? undefined, // 未選択は、送らない（確認で止めている）
    due_on: form.dueOn,
    status: form.status,
    priority: form.priority,
    qms: form.qms,
  }
  if (form.receivedOn) patch.received_on = form.receivedOn
  if (form.status === '確認待ち') patch.confirm_to = form.confirmTo.trim() || null
  // チェックリストは、送ると「その一覧に入れ替わる」。変えていないときは送らない（新しい依頼の元は、空）
  if (!sameChecklist(form.checklist, originalChecklist)) patch.checklist_items = form.checklist
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

/** 今日の日付（YYYY-MM-DD）。パソコンの日付（日本時間）で決める。UTC にすると、朝に前の日になるため */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** 新しい依頼の、空の入力欄。初期値は、ステータス＝未着手、優先度＝中、受付日＝今日、QMS＝オフ、カテゴリー＝先頭。 */
export function emptyForm(firstCategoryId: number | null, today: string): RequestForm {
  return {
    title: '',
    status: '未着手',
    priority: '中',
    description: '',
    requesterName: '',
    requesterExtension: '',
    categoryId: firstCategoryId,
    confirmTo: '',
    receivedOn: today,
    dueOn: '',
    qms: false,
    checklist: [],
  }
}

/**
 * 入力内容が、開いたときから変わっているか（保存していない変更があるか）。
 * 文字は、前後の空白を除いて比べる（空白だけの違いは、変更と見なさない）。チェックリストは、項目の名前・チェック・順番を比べる。
 */
export function isFormChanged(original: RequestForm, current: RequestForm): boolean {
  const textFields = [
    'title',
    'description',
    'requesterName',
    'requesterExtension',
    'confirmTo',
  ] as const
  if (textFields.some((key) => original[key].trim() !== current[key].trim())) return true
  const plainFields = ['status', 'priority', 'categoryId', 'receivedOn', 'dueOn', 'qms'] as const
  if (plainFields.some((key) => original[key] !== current[key])) return true
  return !sameChecklist(original.checklist, current.checklist)
}
