/**
 * アクセシビリティ（読み上げソフトやキーボードで使えるか）の自動検査。axe-core（定番の検査の道具）を使う。
 * 「名前のないボタン」「ラベルのない入力欄」「名前のないモーダル」などを、機械に見つけさせる。
 *
 * テストの環境（jsdom）は、本物のブラウザではないので、次のものは検査できない：
 * - 色のコントラスト（見やすさ）。画面に描かないと、色が決まらないため。検査から外している
 * - 画面の配置、読み上げソフトでの実際の聞こえ方。人が確かめるしかない
 */
import axe, { type AxeResults, type Result } from 'axe-core'
import { expect } from 'vitest'

// 検査から外すもの（理由つき）
const DISABLED_RULES = [
  'color-contrast', // 色は、jsdom では決まらない（描画しないため）
  // 次は、「ページ全体」の決まり。部品だけを描くテストでは、当てはまらない
  'region',
  'landmark-one-main',
  'page-has-heading-one',
  'document-title',
  'html-has-lang',
]

/** 検査して、違反の一覧を返す（違反がなければ、空）。root の中を調べる（既定は、ページ全体） */
export async function a11yViolations(root: Element = document.body): Promise<Result[]> {
  const results: AxeResults = await axe.run(root, {
    rules: Object.fromEntries(DISABLED_RULES.map((id) => [id, { enabled: false }])),
  })
  return results.violations
}

/** 違反を、人が読める文にする（どの規則か・何が問題か・どの要素か） */
export function describeViolations(violations: Result[]): string {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .slice(0, 3)
        .map((node) => `    ${node.html.replace(/\s+/g, ' ').slice(0, 140)}`)
        .join('\n')
      return `- [${violation.id}] ${violation.help}（${violation.nodes.length}か所）\n${targets}`
    })
    .join('\n')
}

/** 違反が1つもないことを、確かめる。あれば、失敗のメッセージに、違反の中身を出す。 */
export async function expectNoA11yViolations(root: Element = document.body): Promise<void> {
  const violations = await a11yViolations(root)
  expect(
    violations.length,
    `アクセシビリティの違反があります：\n${describeViolations(violations)}`,
  ).toBe(0)
}
