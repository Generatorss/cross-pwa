import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/objects', name: 'objects', component: () => import('@/views/ObjectsView.vue') },
    { path: '/journal', name: 'journal', component: () => import('@/views/JournalView.vue') },
    { path: '/scheme', name: 'scheme', component: () => import('@/views/SchemeView.vue') },
  ],
})

export default router