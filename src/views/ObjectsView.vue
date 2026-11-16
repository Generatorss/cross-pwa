<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { syncAll } from '@/sync/engine'
import { db } from '@/db'

interface ObjectRecord {
  id: string
  name: string
  address?: string
  notes?: string
}

const crud = useCrud<ObjectRecord>('objects')
const form = ref({ name: '', address: '', notes: '' })
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
  form.value = { name: '', address: '', notes: '' }
  await refreshPending()
}

function edit(o: ObjectRecord) {
  editingId.value = o.id
  form.value = { name: o.name, address: o.address || '', notes: o.notes || '' }
}

function cancelEdit() {
  editingId.value = null
  form.value = { name: '', address: '', notes: '' }
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
      <h2>Объекты связи</h2>
      <div class="actions">
        <span class="badge" v-if="pendingCount">📤 {{ pendingCount }}</span>
        <button @click="sync">Синхронизировать</button>
      </div>
    </div>

    <p v-if="syncStatus" class="sync-status">{{ syncStatus }}</p>

    <form @submit.prevent="save" class="form">
      <input v-model="form.name" placeholder="Название *" required />
      <input v-model="form.address" placeholder="Адрес" />
      <input v-model="form.notes" placeholder="Примечания" />
      <button type="submit">{{ editingId ? 'Сохранить' : 'Добавить' }}</button>
      <button v-if="editingId" type="button" @click="cancelEdit">Отмена</button>
    </form>

    <table v-if="crud.items.value.length">
      <thead>
        <tr><th>Название</th><th>Адрес</th><th>Примечания</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="o in crud.items.value" :key="o.id">
          <td>{{ o.name }}</td>
          <td>{{ o.address }}</td>
          <td>{{ o.notes }}</td>
          <td class="row-actions">
            <button @click="edit(o)">✏️</button>
            <button @click="crud.remove(o.id).then(refreshPending)">🗑️</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>Нет объектов. Добавьте первый.</p>
  </section>
</template>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.badge {
  background: #fbbf24;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.85rem;
}
.form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.form input {
  padding: 0.4rem;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.form button {
  padding: 0.4rem 0.8rem;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  border-bottom: 1px solid #e5e7eb;
  padding: 0.5rem;
  text-align: left;
}
.row-actions {
  white-space: nowrap;
}
.row-actions button {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1.1rem;
}
.sync-status {
  color: #475569;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}
</style>