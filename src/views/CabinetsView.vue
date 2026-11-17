<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useCrud } from '@/composables/useCrud'
import { syncAll } from '@/sync/engine'
import { db } from '@/db'
import { pb } from '@/api/pocketbase'

interface CabinetRecord {
  id: string
  object: string
  name: string
  location?: string
  notes?: string
}

const route = useRoute()
const objectId = route.params.objectId as string
const objectName = ref('')

const crud = useCrud<CabinetRecord>('cabinets')
const form = ref({ name: '', location: '', notes: '' })
const editingId = ref<string | null>(null)
const syncStatus = ref('')
const pendingCount = ref(0)

const filteredItems = computed(() =>
  crud.items.value.filter((c) => c.object === objectId)
)

async function refreshPending() {
  pendingCount.value = await db.outbox.where('status').equals('pending').count()
}

async function save() {
  if (!form.value.name.trim()) return
  if (editingId.value) {
    await crud.update(editingId.value, { ...form.value })
    editingId.value = null
  } else {
    await crud.create({
      object: objectId,
      name: form.value.name,
      location: form.value.location,
      notes: form.value.notes,
    } as Omit<CabinetRecord, 'id'>)
  }
  form.value = { name: '', location: '', notes: '' }
  await refreshPending()
}

function edit(c: CabinetRecord) {
  editingId.value = c.id
  form.value = { name: c.name, location: c.location || '', notes: c.notes || '' }
}

function cancelEdit() {
  editingId.value = null
  form.value = { name: '', location: '', notes: '' }
}

async function remove(id: string) {
  if (pb.authStore.model?.role !== 'admin') {
    alert('Удаление доступно только администратору.')
    return
  }
  if (!confirm('Удалить шкаф?')) return
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
  const obj = await db.objects.get(objectId)
  objectName.value = obj?.name || '—'
})
</script>

<template>
  <section>
    <p class="breadcrumb">
      <RouterLink to="/objects">Объекты</RouterLink> / {{ objectName }}
    </p>

    <div class="header">
      <h2>Шкафы объекта «{{ objectName }}»</h2>
      <div class="actions">
        <span class="badge" v-if="pendingCount">📤 {{ pendingCount }}</span>
        <button @click="sync">Синхронизировать</button>
      </div>
    </div>

    <p v-if="syncStatus" class="sync-status">{{ syncStatus }}</p>

    <form @submit.prevent="save" class="form">
      <input v-model="form.name" placeholder="Название шкафа *" required />
      <input v-model="form.location" placeholder="Расположение" />
      <input v-model="form.notes" placeholder="Примечания" />
      <button type="submit">{{ editingId ? 'Сохранить' : 'Добавить' }}</button>
      <button v-if="editingId" type="button" @click="cancelEdit">Отмена</button>
    </form>

    <table v-if="filteredItems.length">
      <thead>
        <tr><th>Название</th><th>Расположение</th><th>Примечания</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="c in filteredItems" :key="c.id">
          <td>
            <RouterLink :to="`/cabinets/${c.id}/racks`" class="cabinet-link">{{ c.name }}</RouterLink>
          </td>
          <td>{{ c.location }}</td>
          <td>{{ c.notes }}</td>
          <td class="row-actions">
            <button @click="edit(c)">✏️</button>
            <button v-if="pb.authStore.model?.role === 'admin'" @click="remove(c.id)">🗑️</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>Нет шкафов. Добавьте первый.</p>
  </section>
</template>

<style scoped>
.breadcrumb { color: #64748b; font-size: 0.9rem; margin-bottom: 0.5rem; }
.breadcrumb a { color: #1e40af; text-decoration: none; }
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
.cabinet-link { color: #1e40af; text-decoration: none; }
.cabinet-link:hover { text-decoration: underline; }
</style>