import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueVirtualScroller from 'vue-virtual-scroller'


import './style.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(VueVirtualScroller) // Registers components and directives globally
// Or register directive specifically if needed, but usually package does it.
// Actually checking docs: ObserveVisibility is exported.

app.mount('#app')
