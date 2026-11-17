<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCrud } from '@/composables/useCrud'
import { useAuth } from '@/composables/useAuth'
import { syncAll } from '@/sync/engine'
import { db } from '@/db'

const { isAdmin, isViewer, canEdit } = useAuth()

interface FaultTypeRecord {
  id: string
  name: string
  notes?: string
}

const crud = useCrud<FaultTypeRecord>('fault_types')
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

function edit(f: FaultTypeRecord) {
  editingId.value = f.id
  form.value = { name: f.name, notes: f.notes || '' }
}

function cancelEdit() {
  editingId.value = null
  form.value = { name: '', notes: '' }
}

async function remove(id: string) {
  if (!isAdmin.value) {
    alert('Удаление доступно только администратору.')
    return
  }
  // Защита справочника снизу вверх: нельзя удалить тип, пока он используется в неисправностях
  const used = await db.faults.where('fault_type').equals(id).count()
  if (used > 0) {
    alert(
      `Нельзя удалить тип неисправности: он используется в ${used} записях о неисправностях. ` +
      `Сначала удалите эти записи.`
    )
    return
  }
  const target = crud.items.value.find((f) => f.id === id)
  const label = target ? `тип неисправности «${target.name}»` : 'тип неисправности'
  if (!confirm(`Удалить ${label}?`)) return
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
      <h2>Справочник неисправностей</h2>
      <div class="actions">
        <span class="badge" v-if="pendingCount">📤 {{ pendingCount }}</span>
        <button @click="sync">Синхронизировать</button>
      </div>
    </div>

    <p v-if="syncStatus" class="sync-status">{{ syncStatus }}</p>

    <p class="hint">
      Типы неисправностей пар и жил: обрыв, замыкание, низкое сопротивление изоляции и т.д.
      Добавляйте по мере необходимости — этот справочник используется при внесении
      неисправностей на парах.
    </p>

    <p v-if="isViewer" class="readonly-hint">Режим просмотра: добавление и правка недоступны.</p>
    <form v-if="canEdit" @submit.prevent="save" class="form">
      <input v-model="form.name" placeholder="Название типа *" required size="40" />
      <input v-model="form.notes" placeholder="Примечания" size="50" />
      <button type="submit">{{ editingId ? 'Сохранить' : 'Добавить' }}</button>
      <button v-if="editingId" type="button" @click="cancelEdit">Отмена</button>
    </form>

    <table v-if="crud.items.value.length">
      <thead>
        <tr><th>Название</th><th>Примечания</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="f in crud.items.value" :key="f.id">
          <td>{{ f.name }}</td>
          <td>{{ f.notes }}</td>
          <td class="row-actions">
            <button v-if="canEdit" @click="edit(f)">✏️</button>
            <button v-if="isAdmin" @click="remove(f.id)">🗑️</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>Нет типов неисправностей. Добавьте первый.</p>
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
.readonly-hint { color: #94a3b8; font-size: 0.85rem; font-style: italic; margin-bottom: 0.5rem; }
</style>