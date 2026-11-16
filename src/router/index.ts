import { createRouter, createWebHistory } from 'vue-router'
import { pb } from '@/api/pocketbase'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
    { path: '/objects', name: 'objects', component: () => import('@/views/ObjectsView.vue') },
    { path: '/journal', name: 'journal', component: () => import('@/views/JournalView.vue') },
    { path: '/scheme', name: 'scheme', component: () => import('@/views/SchemeView.vue') },
  ],
})

router.beforeEach((to) => {
  if (to.name !== 'login' && !pb.authStore.isValid) {
    return { name: 'login' }
  }
})

export default router