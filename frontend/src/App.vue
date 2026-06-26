<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppHeader from '@/components/ui/AppHeader.vue'
import AppSidebar from '@/components/ui/AppSidebar.vue'
import BottomNav from '@/components/ui/BottomNav.vue'
</script>

<template>
  <div class="flex flex-col min-h-screen bg-surface dark:bg-surface-dark transition-colors duration-200">
    <!-- Header fixo no topo -->
    <AppHeader />

    <!-- Layout principal: sidebar + conteúdo -->
    <div class="flex flex-1 min-h-0">
      <!-- Sidebar (hidden em mobile) -->
      <AppSidebar />

      <!-- Área de conteúdo com padding responsivo -->
      <!-- pb-20 em mobile: espaço para o bottom nav não cobrir o conteúdo -->
      <main class="flex-1 overflow-auto">
        <div class="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-24 md:pb-6">
          <RouterView v-slot="{ Component, route }">
            <Transition name="fade" mode="out-in">
              <component :is="Component" :key="route.path" />
            </Transition>
          </RouterView>
        </div>
      </main>
    </div>

    <!-- Bottom nav (só mobile) -->
    <BottomNav />
  </div>
</template>

<style>
/* Transição suave entre rotas */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

