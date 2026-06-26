import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import GargalosView from '@/views/GargalosView.vue'
import EventosView from '@/views/EventosView.vue'

const routes = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardView,
    meta: { title: 'Dashboard — PIJA' },
  },
  {
    path: '/gargalos',
    name: 'gargalos',
    component: GargalosView,
    meta: { title: 'Gargalos — PIJA' },
  },
  {
    path: '/eventos',
    name: 'eventos',
    component: EventosView,
    meta: { title: 'Eventos — PIJA' },
  },
  // Fase 3: { path: '/login', name: 'login', component: LoginView }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

// Atualizar title da página na navegação
router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ?? 'PIJA — Jornada Assistencial'
})

export default router
