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
    { path: '/objects/:objectId/cabinets', name: 'cabinets', component: () => import('@/views/CabinetsView.vue') },
    { path: '/cabinets/:cabinetId/racks', name: 'racks', component: () => import('@/views/RacksView.vue') },
    { path: '/racks/:rackId/boxes', name: 'boxes', component: () => import('@/views/BoxesView.vue') },
    { path: '/boxes/:boxId/plints', name: 'plints', component: () => import('@/views/PlintsView.vue') },
    { path: '/plints/:plintId/pairs', name: 'pairs', component: () => import('@/views/PairsView.vue') },
    { path: '/pairs/:pairId', name: 'pair-detail', component: () => import('@/views/PairDetailView.vue') },
    { path: '/lines', name: 'lines', component: () => import('@/views/LinesView.vue') },
    { path: '/fault-types', name: 'fault-types', component: () => import('@/views/FaultTypesView.vue') },
    
  ],
})

router.beforeEach((to) => {
  if (to.name !== 'login' && !pb.authStore.isValid) {
    return { name: 'login' }
  }
})

export default router