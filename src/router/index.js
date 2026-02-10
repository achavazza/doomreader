import { createRouter, createWebHistory } from 'vue-router'
import ShelfView from '../views/ShelfView.vue'
import ReaderView from '../views/ReaderView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'shelf',
      component: ShelfView
    },
    {
      path: '/reader/:id',
      name: 'reader',
      component: ReaderView
    }
  ],
})

export default router
