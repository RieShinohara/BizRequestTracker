# 画面の骨組み（Vue 3・TypeScript・Vuetify・Vite）

## 作ったもの
| 場所 | 中身 |
|---|---|
| `frontend/package.json` | 使う部品と、コマンド（`dev`・`build`・`test`・`lint`・`format`） |
| `frontend/vite.config.ts` | ポート 5173 の固定、`/api` と `/health` を API（8000番）へ中継する設定、テストの設定 |
| `frontend/src/main.ts` | Vue と Vuetify の起動。基調色（primary）の設定 |
| `frontend/src/api.ts` | API を呼ぶ部品。今は `checkHealth`（`GET /health`）だけ |
| `frontend/src/App.vue` | 動作確認用の仮の画面。API につながっているかを表示する |
| `frontend/src/api.test.ts` | `checkHealth` のテスト（4件） |
| `frontend/eslint.config.js`、`.prettierrc.json` | 静的チェックと整形の設定 |

プロトタイプ（`prototype/`）は、そのまま残した。必要な見た目の部分を、次の Issue から、`frontend/` に写していく。

## 学んだこと
- **画面と API は、別々のサーバー**：画面（Vite）は 5173 番、API（FastAPI）は 8000 番。ブラウザから見ると、別の「入口」なので、そのままだと、ブラウザの安全の仕組み（**CORS**）に止められる
- **開発用サーバーの中継（プロキシ）**：`vite.config.ts` に `proxy` を書くと、画面から `/api/...` を呼んだとき、Vite が、API（8000番）に代わりに呼んでくれる。ブラウザからは、画面と API が「同じ入口」に見えるので、CORS を気にしなくてよい。画面のコードは、`fetch('/api/requests')` と、短く書ける
- **`localhost` と `127.0.0.1`**：Vite の開発用サーバーは、`localhost`（IPv6 の `::1`）で待っていた。そのため、`http://127.0.0.1:5173` ではつながらず、`http://localhost:5173` ではつながった。ブラウザでは `localhost` を使う
- **API を呼ぶ部品を、1か所に集める**（`api.ts`）：画面の部品（`.vue`）が、あちこちで `fetch` を書くと、URL の変更やエラー処理を、全部直すことになる。呼び出しを1か所にまとめると、テストもしやすい
- **API の呼び出しのテスト**：本物の API を呼ばず、`fetch` を偽物に差し替える（`vi.stubGlobal`）。つながる・つながらない・エラーの場合を、API を起動せずに試せる
- **ツールの役割**：Vite＝開発用サーバーとビルド、Vitest＝テスト、ESLint＝間違いやすい書き方の検査（静的チェック）、Prettier＝見た目の整形、`vue-tsc`＝型の検査（TypeScript）
- **ESLint と Prettier の役割分担**：ESLint は「書き方の間違い」、Prettier は「見た目の整え方」。ぶつかる規則は、`eslint-config-prettier` で ESLint 側を切る

## 気づいたこと
- **ビルドのときの警告**：「ファイルが大きい（500kB 超）」と出る。Vuetify の全部品を入れているため。動作には影響しない。必要になったら、使う部品だけを入れる形に直せる
- **`npm audit` の「中程度」11件**：すべて、ESLint が使う `minimatch` という部品。開発用の道具の中にあり、本番の画面には入らない（本番に入る部品だけを調べると、0件）。直す方法（`--force`）は、ESLint のバージョンが大きく変わる恐れがあるので、今は直していない。ESLint の更新が出たら、見直す

## 要件にない、私（Claude Code）が決めた点
- 部品は、プロトタイプと同じ系統にそろえた（Vue 3.5、Vuetify 4.3、Vite 8、TypeScript 6）
- テスト（Vitest）は、まず `node` の環境で動かす。画面の部品のテストが必要になったら、`jsdom`（ブラウザの代わり）を足す
- Prettier の書き方：セミコロンなし、シングルクォート、1行100文字（プロトタイプの書き方に合わせた）
