import { addDays, todayIso } from './dates'
import type { Category, ChecklistItem, Request, Requester, TemplateItem } from './types'

// すべて架空のデータ。日付は「今日」からの日数で決めるので、いつ開いても色分けを確かめられる。

export const categories: Category[] = [
  { id: 1, name: 'HP' },
  { id: 2, name: '動画' },
  { id: 3, name: '研究倫理委員会' },
  { id: 4, name: '通関' },
  { id: 5, name: '取扱説明書' },
  { id: 6, name: 'AIアカウント発行' },
  { id: 7, name: '引っ越し' },
]

const templateNames: Record<number, string[]> = {
  1: ['原稿の確認', '素材の収集', '修正・追加', 'プレビューチェック', '依頼者等の確認', '確認後の修正', '承認後の公開', '管理表記入'],
  2: ['企画の打ち合わせ', '絵コンテ作成', '素材の収集', '映像の編集', 'テロップ原稿作成（翻訳）', 'テロップ挿入', 'SE・BGM挿入', 'オープニング作成', '書き出し・チェック', '依頼者等の確認', '確認後の修正', '納品'],
  3: ['日程連絡・参加の回答', '資料の受け取り', '資料の内容確認', '想定問答集の確認', '会議参加'],
  4: ['取引内容の情報収集', '非該当証明用のチェックリスト発行', '非該当証明書作成・押印', 'インボイス作成', 'パッキングリスト作成', '危険物証明書発行', '輸出証明書発行', '代行用のパスポートコピー取得', 'ダブルチェック', '通関書類一式と荷物の突合せ', '通関書類の格納'],
  5: ['依頼内容の詳細聞き取り', '画像の用意', '文章作成', 'Wordへの清書', '変更履歴の反映', '依頼者等への確認', '確認後の修正', '納品', '表への記入'],
  6: ['依頼者のアドレス確認', '日割り価格の確認', '購買申請', '承認後にアカウント追加', 'ユーザーへメール連絡', 'カード利用申請'],
  7: ['見積もり依頼', '業者の選定', '現状の備品の確認', 'レイアウト図の作成', '各種届出', '当日の段取りの確認'],
}

export const templateItems: TemplateItem[] = Object.entries(templateNames).flatMap(
  ([categoryId, names]) => names.map((name) => ({ categoryId: Number(categoryId), name })),
)

export const requesters: Requester[] = [
  { id: 1, name: '青木 一郎', extension: '2101' },
  { id: 2, name: '石井 花子', extension: '2214' },
  { id: 3, name: '上田 健', extension: '3032' },
  { id: 4, name: '遠藤 美咲', extension: '' },
  { id: 5, name: '大野 次郎', extension: '4105' },
]

let checklistId = 1

/** カテゴリーのテンプレートをコピーして、チェックリストを作る。doneCount 個を済みにする */
export function checklistFromTemplate(categoryId: number, doneCount = 0): ChecklistItem[] {
  return templateItems
    .filter((t) => t.categoryId === categoryId)
    .map((t, i) => ({ id: checklistId++, name: t.name, done: i < doneCount }))
}

const today = todayIso()
const d = (days: number) => addDays(today, days)

function make(
  id: number,
  p: Omit<Request, 'id' | 'checklist' | 'archived' | 'confirmTo' | 'qms'> &
    Partial<Pick<Request, 'archived' | 'confirmTo' | 'qms'>>,
  doneCount: number | null,
): Request {
  return {
    id,
    archived: false,
    confirmTo: '',
    qms: false,
    ...p,
    checklist: doneCount === null ? [] : checklistFromTemplate(p.categoryId, doneCount),
  }
}

export const initialRequests: Request[] = [
  make(1, { title: '製品サイトの仕様表を更新', description: '新型番の仕様表をHPに追加する。', requesterId: 1, categoryId: 1, receivedOn: d(-6), dueOn: d(-1), status: '作業中', priority: '急ぎ', qms: true }, 3),
  make(2, { title: '輸出貨物A案件の通関書類', description: '来週発送予定の貨物の書類一式。', requesterId: 3, categoryId: 4, receivedOn: d(-4), dueOn: d(2), status: '作業中', priority: '高' }, 5),
  make(3, { title: '製品紹介動画の作成', description: '30秒の紹介動画。字幕は英語。', requesterId: 2, categoryId: 2, receivedOn: d(-10), dueOn: d(5), status: '確認待ち', priority: '中', confirmTo: '営業部', qms: false }, 9),
  make(4, { title: '取扱説明書の改訂（第3版）', description: '変更履歴を反映して改訂する。', requesterId: 5, categoryId: 5, receivedOn: d(-8), dueOn: d(9), status: '確認待ち', priority: '高', confirmTo: '薬事部', qms: true }, 5),
  make(5, { title: '倫理委員会（11月定例）の出席', description: '定例会議への出席。', requesterId: 4, categoryId: 3, receivedOn: d(-2), dueOn: d(7), status: '未着手', priority: '中' }, 0),
  make(6, { title: '新入社員のAIツールアカウント発行', description: '3名分。', requesterId: 2, categoryId: 6, receivedOn: d(-1), dueOn: d(3), status: '未着手', priority: '低' }, null),
  make(7, { title: '採用ページの文言修正', description: '募集要項の文言を直す。', requesterId: 1, categoryId: 1, receivedOn: d(-12), dueOn: d(14), status: 'ペンディング', priority: '低' }, 2),
  make(8, { title: 'オフィス移転の見積もり取得', description: '3社から見積もりを取る。', requesterId: 5, categoryId: 7, receivedOn: d(-3), dueOn: d(20), status: '作業中', priority: '中' }, 1),
  make(9, { title: '展示会用の機器の通関', description: '展示会に持ち出す機器の書類。', requesterId: 3, categoryId: 4, receivedOn: d(-20), dueOn: d(-10), status: '完了', priority: '高', qms: true }, 11),
  make(10, { title: '会社案内動画の差し替え', description: '古い動画を新版に差し替え。', requesterId: 4, categoryId: 2, receivedOn: d(-30), dueOn: d(-18), status: '完了', priority: '中', archived: true }, 12),
  make(11, { title: '旧製品の取扱説明書の廃版対応', description: '', requesterId: 2, categoryId: 5, receivedOn: d(-40), dueOn: d(-25), status: 'ペンディング', priority: '低', archived: true }, null),
  make(12, { title: 'ニュースリリースのHP掲載', description: '本日付のリリースを掲載する。', requesterId: 1, categoryId: 1, receivedOn: d(0), dueOn: d(0), status: '作業中', priority: '急ぎ' }, 2),
]
