import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'
import { useThemeStore } from './stores/useThemeStore'

const app = createApp(App)

app.use(createPinia())
app.use(router)
useThemeStore().init()
app.mount('#app')
