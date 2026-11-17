<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { syncAll } from '@/sync/engine'
import { db } from '@/db'
import { pb } from '@/api/pocketbase'

interface LineRecord {
  id: string
  name: string
  notes?: string
}

const crud = useCrud<LineRecord>('lines')
const form = ref({ name: '', notes: '' })
const editingId = ref<string | null>(null)
const syncStatus = ref('')
const pendingCount = ref(0)

async function refreshPending() {
  pendingCount.value = await db.outbox.where('status').equals('pending').count()
}

async function save() {
  if (!form.value.name.trim()) return
  if (editingId.value) {
    await crud.update(editingId.value, { ...form.value })
    editingId.value = null
  } else {
    await crud.create({ ...form.value })
  }
  form.value = { name: '', notes: '' }
  await refreshPending()
}

function edit(l: LineRecord) {
  editingId.value = l.id
  form.value = { name: l.name, notes: l.notes || '' }
}

function cancelEdit() {
  editingId.value = null
  form.value = { name: '', notes: '' }
}

async function remove(id: string) {
  if (pb.authStore.model?.role !== 'admin') {
    alert('Удаление доступно только администратору.')
    return
  }
  if (!confirm('Удалить линию? Пары, привязанные к ней, останутся без линии.')) return
  try {
    await crud.remove(id)
    await refreshPending()
  } catch (e: any) {
    alert(`Ошибка удаления: ${e.message}`)
  }
}

async function sync() {
  syncStatus.value = 'Синхронизация…'
  try {
    const r = await syncAll()
    syncStatus.value = `Отправлено: ${r.pushed}, получено: ${r.pulled}${r.failed ? `, ошибок: ${r.failed}` : ''}`
    await crud.load()
    await refreshPending()
  } catch (e: any) {
    syncStatus.value = `Ошибка: ${e.message}`
  }
}

onMounted(async () => {
  await crud.load()
  await refreshPending()
})
</script>

<template>
  <section>
    <div class="header">
      <h2>Справочник линий</h2>
      <div class="actions">
        <span class="badge" v-if="pendingCount">📤 {{ pendingCount }}</span>
        <button @click="sync">Синхронизировать</button>
      </div>
    </div>

    <p v-if="syncStatus" class="sync-status">{{ syncStatus }}</p>

    <p class="hint">
      Линия — сквозная логическая цепь через несколько объектов (например, «Громкая связь»,
      «Магнитофон объекта 1 — Зап. устр. объекта 4»). На разных объектах она занимает разные
      пары, но называется одинаково.
    </p>

    <form @submit.prevent="save" class="form">
      <input v-model="form.name" placeholder="Название линии *" required size="50" />
      <input v-model="form.notes" placeholder="Примечания" size="40" />
      <button type="submit">{{ editingId ? 'Сохранить' : 'Добавить' }}</button>
      <button v-if="editingId" type="button" @click="cancelEdit">Отмена</button>
    </form>

    <table v-if="crud.items.value.length">
      <thead>
        <tr><th>Название</th><th>Примечания</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="l in crud.items.value" :key="l.id">
          <td>{{ l.name }}</td>
          <td>{{ l.notes }}</td>
          <td class="row-actions">
            <button @click="edit(l)">✏️</button>
            <button v-if="pb.authStore.model?.role === 'admin'" @click="remove(l.id)">🗑️</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>Нет линий. Добавьте первую.</p>
  </section>
</template>

<style scoped>
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.actions { display: flex; gap: 0.5rem; align-items: center; }
.badge { background: #fbbf24; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.85rem; }
.hint { color: #64748b; font-size: 0.85rem; margin-bottom: 0.75rem; max-width: 800px; }
.form { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
.form input { padding: 0.4rem; border: 1px solid #ccc; border-radius: 6px; }
.form button { padding: 0.4rem 0.8rem; border: 1px solid #ccc; background: #fff; border-radius: 6px; cursor: pointer; }
table { width: 100%; border-collapse: collapse; }
th, td { border-bottom: 1px solid #e5e7eb; padding: 0.5rem; text-align: left; }
.row-actions { white-space: nowrap; }
.row-actions button { border: none; background: none; cursor: pointer; font-size: 1.1rem; }
.sync-status { color: #475569; font-size: 0.9rem; margin-bottom: 0.5rem; }
</style>