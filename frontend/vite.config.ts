import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// API（バックエンド）は 8000 番。画面は 5173 番（どちらも固定。別のポートでは起動しない）
const API_ORIGIN = 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
    // 画面から /api と /health を呼ぶと、開発用サーバーが、API（8000番）に中継する。
    // 画面と API が「同じ入口」に見えるので、ブラウザの制限（CORS）を気にしなくてよい
    proxy: {
      '/api': API_ORIGIN,
      '/health': API_ORIGIN,
    },
  },
  test: {
    // ふつうのテスト（関数だけ）は、軽い node で動かす。部品を描くテストは、そのファイルの先頭に
    // 「// @vitest-environment jsdom」と書いて、ブラウザの代わり（jsdom）で動かす
    environment: 'node',
    // Vuetify は、部品の中で CSS を読み込む。テストの道具に、そのまま読ませる（CSS の中身は、使わない）
    server: { deps: { inline: ['vuetify'] } },
    // カバレッジ（テストが、コードのどの行・分岐まで通ったか）。npm run test:coverage で測る
    coverage: {
      provider: 'v8',
      // 測る対象：画面のコード（src）。次のものは、測る意味がないので、外す
      include: ['src/**/*.{ts,vue}'],
      exclude: [
        'src/**/*.test.ts', // テスト自身
        'src/test-utils/**', // テストの道具
        'src/main.ts', // 起動の入口（画面を作って、Vuetify をつなぐだけ。テストで動かす意味がない）
        'src/env.d.ts', // 型の宣言だけ（動くコードがない）
      ],
      // 画面に出す表（text）と、詳しい表（html。coverage/index.html をブラウザで開くと、通らなかった行が赤く見える）
      // しきい値（これを下回ると、テストが失敗する）。測った数字（2026-11-08：文 64.7・分岐 76.2・関数 64.4・行 66.6）より、
      // 少し下に置く。テストを書かずにコードを増やすと、割合が下がり、CI が気づかせてくれる。ぴったりにすると、
      // 小さな変更でも失敗して、うるさいので、余裕を持たせた。100% は、目指さない（意味のないテストを増やさない）。
      // 数字が上がったら、ここも上げる。App.vue・RequestFilters.vue・SummaryChips.vue は、まだ 0%（部品のテストが、まだない）
      thresholds: { statements: 60, branches: 70, functions: 60, lines: 62 },
      // text は、100% のファイルも省かずに、すべて出す（skipFull: false）
      reporter: [['text', { skipFull: false }], 'html'],
    },
  },
})
