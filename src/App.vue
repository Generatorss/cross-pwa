<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { pb } from '@/api/pocketbase'

const sidebarOpen = ref(false)
const user = ref<any>(pb.authStore.model)
const router = useRouter()

pb.authStore.onChange(() => {
  user.value = pb.authStore.model
})

function logout() {
  pb.authStore.clear()
  router.push('/login')
}
</script>

<template>
  <div class="app-layout">
    <aside :class="{ open: sidebarOpen }">
      <h1>Кроссы</h1>
      <nav>
        <RouterLink to="/">Главная</RouterLink>
        <RouterLink to="/objects">Объекты</RouterLink>
        <RouterLink to="/lines">Линии</RouterLink>
        <RouterLink to="/fault-types">Неисправности</RouterLink>
        <RouterLink to="/journal">Журнал</RouterLink>
        <RouterLink to="/scheme">Схема</RouterLink>
      </nav>
    </aside>
    <main>
      <header class="topbar">
        <button class="menu-toggle" @click="sidebarOpen = !sidebarOpen">☰</button>
        <div class="topbar-spacer"></div>
        <div v-if="user" class="user-chip">
          <span class="user-email">{{ user.email }}</span>
          <span class="user-role" :class="`role-${user.role || 'none'}`">{{ user.role || 'нет роли' }}</span>
          <button class="logout-btn" @click="logout">Выйти</button>
        </div>
        <RouterLink v-else to="/login" class="login-link">Войти</RouterLink>
      </header>
      <div class="content">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #f5f5f5; color: #222; }
.app-layout { display: flex; min-height: 100vh; }
aside {
  width: 220px; background: #1e293b; color: #fff; padding: 1rem;
  display: flex; flex-direction: column; gap: 1rem;
}
aside h1 { font-size: 1.1rem; }
aside nav { display: flex; flex-direction: column; gap: 0.5rem; }
aside a { color: #cbd5e1; text-decoration: none; padding: 0.4rem 0.6rem; border-radius: 6px; }
aside a.router-link-active { background: #334155; color: #fff; }
main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.topbar {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.5rem 1rem;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  min-height: 48px;
}
.topbar-spacer { flex: 1; }
.user-chip { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
.user-email { color: #334155; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-role {
  padding: 0.15rem 0.5rem; border-radius: 10px;
  font-size: 0.75rem; font-weight: 500;
}
.role-admin { background: #fee2e2; color: #991b1b; }
.role-editor { background: #dbeafe; color: #1e40af; }
.role-viewer { background: #e5e7eb; color: #374151; }
.role-none { background: #fef3c7; color: #92400e; }
.logout-btn {
  padding: 0.25rem 0.6rem; border: 1px solid #cbd5e1;
  background: #fff; border-radius: 6px; cursor: pointer; font-size: 0.85rem;
}
.logout-btn:hover { background: #f1f5f9; }
.login-link {
  padding: 0.25rem 0.6rem; border: 1px solid #1e40af;
  background: #1e40af; color: #fff; border-radius: 6px;
  text-decoration: none; font-size: 0.85rem;
}
.content { padding: 1.5rem; flex: 1; }
.menu-toggle {
  display: none; background: none; border: none; font-size: 1.5rem; cursor: pointer;
}
@media (max-width: 768px) {
  aside {
    position: fixed; inset: 0 auto 0 0; width: 240px;
    transform: translateX(-100%); transition: transform 0.2s; z-index: 10;
  }
  aside.open { transform: translateX(0); }
  .menu-toggle { display: block; }
  .user-email { max-width: 120px; }
  .content { padding: 1rem; }
}
</style>