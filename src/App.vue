<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'

const sidebarOpen = ref(false)
</script>

<template>
  <div class="app-layout">
    <aside :class="{ open: sidebarOpen }">
      <h1>Кроссы</h1>
      <nav>
        <RouterLink to="/">Главная</RouterLink>
        <RouterLink to="/objects">Объекты</RouterLink>
        <RouterLink to="/journal">Журнал</RouterLink>
        <RouterLink to="/scheme">Схема</RouterLink>
      </nav>
    </aside>
    <main>
      <button class="menu-toggle" @click="sidebarOpen = !sidebarOpen">☰</button>
      <RouterView />
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
main { flex: 1; padding: 1.5rem; position: relative; }
.menu-toggle { display: none; position: absolute; top: 1rem; left: 1rem; background: none; border: none; font-size: 1.5rem; }
@media (max-width: 768px) {
  aside { position: fixed; inset: 0 auto 0 0; transform: translateX(-100%); transition: transform 0.2s; z-index: 10; }
  aside.open { transform: translateX(0); }
  main { padding-top: 3.5rem; }
  .menu-toggle { display: block; }
}
</style>