<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useAuth } from '@/composables/useAuth'
import { syncAll } from '@/sync/engine'
import { db } from '@/db'
import { countCascade, cascadeDelete, cascadeConfirmText } from '@/utils/cascade'

const { isAdmin, isViewer, canEdit } = useAuth()

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

async function remove(id: string) {
  if (!isAdmin.value) {
    alert('Удаление доступно только администратору.')
    return
  }
  const target = crud.items.value.find((o) => o.id === id)
  const label = target ? `объект «${target.name}»` : 'объект'
  try {
    const stats = await countCascade('objects', id)
    if (!confirm(cascadeConfirmText(label, stats))) return
    await cascadeDelete('objects', id)
    await crud.load()
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
      <h2>Объекты связи</h2>
      <div class="actions">
        <span class="badge" v-if="pendingCount">📤 {{ pendingCount }}</span>
        <button @click="sync">Синхронизировать</button>
      </div>
    </div>

    <p v-if="syncStatus" class="sync-status">{{ syncStatus }}</p>

    <p v-if="isViewer" class="readonly-hint">Режим просмотра: добавление и правка недоступны.</p>
    <form v-if="canEdit" @submit.prevent="save" class="form">
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
          <td>
            <RouterLink :to="`/objects/${o.id}/cabinets`" class="object-link">{{ o.name }}</RouterLink>
          </td>
          <td>{{ o.address }}</td>
          <td>{{ o.notes }}</td>
          <td class="row-actions">
            <button v-if="canEdit" @click="edit(o)">✏️</button>
            <button v-if="isAdmin" title="Удалить со всем содержимым" @click="remove(o.id)">🗑️</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>Нет объектов. Добавьте первый.</p>
  </section>
</template>

<style scoped>
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.actions { display: flex; gap: 0.5rem; align-items: center; }
.badge { background: #fbbf24; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.85rem; }
.form { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
.form input { padding: 0.4rem; border: 1px solid #ccc; border-radius: 6px; }
.form button { padding: 0.4rem 0.8rem; border: 1px solid #ccc; background: #fff; border-radius: 6px; cursor: pointer; }
table { width: 100%; border-collapse: collapse; }
th, td { border-bottom: 1px solid #e5e7eb; padding: 0.5rem; text-align: left; }
.row-actions { white-space: nowrap; }
.row-actions button { border: none; background: none; cursor: pointer; font-size: 1.1rem; }
.sync-status { color: #475569; font-size: 0.9rem; margin-bottom: 0.5rem; }
.readonly-hint { color: #94a3b8; font-size: 0.85rem; font-style: italic; margin-bottom: 0.5rem; }
.object-link { color: #1e40af; text-decoration: none; }
.object-link:hover { text-decoration: underline; }
</style>