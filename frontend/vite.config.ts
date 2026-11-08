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
  },
})
