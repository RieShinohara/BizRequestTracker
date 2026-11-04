import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // ポートは固定（別のポートでは起動しない）
  server: { port: 5173, strictPort: true },
})
