import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import App from './App.vue'

// 色を指定しない部品が黒く見えないように、標準の色（primary）を決める
const vuetify = createVuetify({
  components,
  directives,
  // 全体の基調色（primary）。インディゴ。試した色：標準の青 #1867C0、ティール #00897B、ディープパープル #5E35B1。色を変えるときは、ここだけ直す
  theme: {
    defaultTheme: 'light',
    themes: {
      light: { colors: { primary: '#3949AB' } },
    },
  },
  defaults: {
    VBtn: { color: 'primary' },
    VCheckbox: { color: 'primary' },
    VSwitch: { color: 'primary' },
    VTextField: { color: 'primary' },
    VTextarea: { color: 'primary' },
    VSelect: { color: 'primary' },
    VCombobox: { color: 'primary' },
  },
})

createApp(App).use(vuetify).mount('#app')
