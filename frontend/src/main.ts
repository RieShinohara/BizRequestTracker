import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import '@fontsource-variable/noto-sans-jp'
import '@mdi/font/css/materialdesignicons.css'
import App from './App.vue'
import './styles.css'

// 色を指定しない部品が黒く見えないように、標準の色（primary）を決める。色を変えるときは、ここだけ直す。
// 文字色：真っ黒（Vuetify の標準は、黒の 87% の濃さ）が強いので、薄めのグレー（#4A4A4A）にした。
// Vuetify は、文字色に「濃さ」（high-emphasis-opacity）を掛けるので、色そのもので決めるため、100% にした
const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: { primary: '#3949AB', 'on-surface': '#4A4A4A', 'on-background': '#4A4A4A' },
        variables: { 'high-emphasis-opacity': 1 },
      },
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
