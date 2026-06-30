import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import GargalosView from '@/views/GargalosView.vue'
import JornadaView from '@/views/JornadaView.vue'
import MetodologiaView from '@/views/MetodologiaView.vue'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { title: 'Dashboard — PIJA' } },
  { path: '/gargalos', name: 'gargalos', component: GargalosView, meta: { title: 'Gargalos — PIJA' } },
  { path: '/jornada', name: 'jornada', component: JornadaView, meta: { title: 'Jornada — PIJA' } },
  { path: '/metodologia', name: 'metodologia', component: MetodologiaView, meta: { title: 'Metodologia — PIJA' } },
  { path: '/eventos', redirect: '/jornada' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  document.title = (to.meta.title as string | undefined) ?? 'PIJA — Jornada Assistencial'
})

export default router
