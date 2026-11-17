<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useCrud } from '@/composables/useCrud'
import { syncAll } from '@/sync/engine'
import { db } from '@/db'
import { pb } from '@/api/pocketbase'
import { enqueueDelete } from '@/utils/outbox'

interface BoxRecord {
  id: string
  rack: string
  number: string
  type?: string
  notes?: string
}

const route = useRoute()
const rackId = route.params.rackId as string
const rackName = ref('')
const cabinetId = ref('')
const cabinetName = ref('')
const objectId = ref('')
const objectName = ref('')

const crud = useCrud<BoxRecord>('boxes')
const form = ref({ number: '', type: '', notes: '' })
const editingId = ref<string | null>(null)
const syncStatus = ref('')
const pendingCount = ref(0)
const selectedIds = ref<Set<string>>(new Set())

const filteredItems = computed(() =>
  crud.items.value.filter((b) => b.rack === rackId)
)

const isAdmin = computed(() => pb.authStore.model?.role === 'admin')
const allSelected = computed(
  () => filteredItems.value.length > 0 && selectedIds.value.size === filteredItems.value.length
)
const someSelected = computed(
  () => selectedIds.value.size > 0 && selectedIds.value.size < filteredItems.value.length
)

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(filteredItems.value.map((b) => b.id))
  }
}

async function refreshPending() {
  pendingCount.value = await db.outbox.where('status').equals('pending').count()
}

async function save() {
  if (!form.value.number.trim()) return
  if (editingId.value) {
    await crud.update(editingId.value, { ...form.value })
    editingId.value = null
  } else {
    await crud.create({
      rack: rackId,
      number: form.value.number,
      type: form.value.type,
      notes: form.value.notes,
    } as Omit<BoxRecord, 'id'>)
  }
  form.value = { number: '', type: '', notes: '' }
  await refreshPending()
}

function edit(b: BoxRecord) {
  editingId.value = b.id
  form.value = { number: b.number, type: b.type || '', notes: b.notes || '' }
}

function cancelEdit() {
  editingId.value = null
  form.value = { number: '', type: '', notes: '' }
}

/** Двойной каскад: pairs → plints → boxes. */
async function deleteCascade(boxIds: string[]) {
  const now = new Date().toISOString()

  for (const boxId of boxIds) {
    const boxPlints = await db.plints.where('box').equals(boxId).toArray()
    console.log(`[cascade] бокс ${boxId}: найдено ${boxPlints.length} плинтов`)

    for (const plint of boxPlints) {
      const plintPairs = await db.pairs.where('plint').equals(plint.id).toArray()
      console.log(`[cascade]   плинт ${plint.id}: ${plintPairs.length} пар`)

      for (const pair of plintPairs) {
        await db.pairs.delete(pair.id)
        await enqueueDelete('pairs', pair.id, now)
      }

      await db.plints.delete(plint.id)
      await enqueueDelete('plints', plint.id, now)
    }

    await db.boxes.delete(boxId)
    await enqueueDelete('boxes', boxId, now)
  }
}

async function remove(id: string) {
  if (!isAdmin.value) {
    alert('Удаление доступно только администратору.')
    return
  }
  if (!confirm('Удалить бокс? Все плинты и пары внутри также будут удалены.')) return
  try {
    await deleteCascade([id])
    await crud.load()
    await refreshPending()
  } catch (e: any) {
    alert(`Ошибка удаления: ${e.message}`)
  }
}

async function deleteSelected() {
  if (!isAdmin.value) {
    alert('Удаление доступно только администратору.')
    return
  }
  const ids = Array.from(selectedIds.value)
  if (ids.length === 0) return
  if (!confirm(`Удалить ${ids.length} бокс(ов)? Все плинты и пары внутри также будут удалены.`)) return

  try {
    await deleteCascade(ids)
    selectedIds.value = new Set()
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
  const rack = await db.racks.get(rackId)
  if (rack) {
    rackName.value = rack.name
    cabinetId.value = rack.cabinet
    const cabinet = await db.cabinets.get(rack.cabinet)
    if (cabinet) {
      cabinetName.value = cabinet.name
      objectId.value = cabinet.object
      const obj = await db.objects.get(cabinet.object)
      objectName.value = obj?.name || '—'
    }
  }
})
</script>

<template>
  <section>
    <p class="breadcrumb">
      <RouterLink to="/objects">Объекты</RouterLink>
      /
      <RouterLink v-if="objectId" :to="`/objects/${objectId}/cabinets`">{{ objectName }}</RouterLink>
      /
      <RouterLink v-if="cabinetId" :to="`/cabinets/${cabinetId}/racks`">{{ cabinetName }}</RouterLink>
      /
      {{ rackName }}
    </p>

    <div class="header">
      <h2>Боксы стойки «{{ rackName }}»</h2>
      <div class="actions">
        <span class="badge" v-if="pendingCount">📤 {{ pendingCount }}</span>
        <button @click="sync">Синхронизировать</button>
        <button
          v-if="selectedIds.size > 0 && isAdmin"
          class="danger"
          @click="deleteSelected"
        >
          Удалить выбранные ({{ selectedIds.size }})
        </button>
      </div>
    </div>

    <p v-if="syncStatus" class="sync-status">{{ syncStatus }}</p>

    <form @submit.prevent="save" class="form">
      <input v-model="form.number" placeholder="Номер бокса *" required />
      <input v-model="form.type" placeholder="Тип (например, 100-парный)" />
      <input v-model="form.notes" placeholder="Примечания" />
      <button type="submit">{{ editingId ? 'Сохранить' : 'Добавить' }}</button>
      <button v-if="editingId" type="button" @click="cancelEdit">Отмена</button>
    </form>

    <table v-if="filteredItems.length">
      <thead>
        <tr>
          <th class="col-select">
            <input
              type="checkbox"
              :checked="allSelected"
              :indeterminate="someSelected"
              @change="toggleSelectAll"
              :disabled="!isAdmin"
            />
          </th>
          <th>Номер</th>
          <th>Тип</th>
          <th>Примечания</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="b in filteredItems" :key="b.id">
          <td class="col-select">
            <input
              type="checkbox"
              :checked="selectedIds.has(b.id)"
              @change="toggleSelect(b.id)"
              :disabled="!isAdmin"
            />
          </td>
          <td>
            <RouterLink :to="`/boxes/${b.id}/plints`" class="box-link">{{ b.number }}</RouterLink>
          </td>
          <td>{{ b.type }}</td>
          <td>{{ b.notes }}</td>
          <td class="row-actions">
            <button @click="edit(b)">✏️</button>
            <button class="delete-btn" @click="remove(b.id)" :title="isAdmin ? 'Удалить' : 'Только для администратора'">🗑️</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>Нет боксов. Добавьте первый.</p>
  </section>
</template>

<style scoped>
.breadcrumb { color: #64748b; font-size: 0.9rem; margin-bottom: 0.5rem; }
.breadcrumb a { color: #1e40af; text-decoration: none; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem; }
.actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.actions button { padding: 0.4rem 0.8rem; border: 1px solid #ccc; background: #fff; border-radius: 6px; cursor: pointer; }
.actions button.danger { background: #dc2626; color: #fff; border-color: #dc2626; }
.actions button.danger:hover { background: #b91c1c; }
.badge { background: #fbbf24; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.85rem; }
.form { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
.form input { padding: 0.4rem; border: 1px solid #ccc; border-radius: 6px; }
.form button { padding: 0.4rem 0.8rem; border: 1px solid #ccc; background: #fff; border-radius: 6px; cursor: pointer; }
table { width: 100%; border-collapse: collapse; }
th, td { border-bottom: 1px solid #e5e7eb; padding: 0.5rem; text-align: left; }
th { background: #f8fafc; font-weight: 600; }
.col-select { width: 32px; text-align: center; }
.col-select input { cursor: pointer; }
.row-actions { white-space: nowrap; }
.row-actions button { border: none; background: none; cursor: pointer; font-size: 1.1rem; }
.delete-btn { padding: 0.2rem; border-radius: 4px; }
.delete-btn:hover { background: #fee2e2; }
.box-link { color: #1e40af; text-decoration: none; }
.box-link:hover { text-decoration: underline; }
.sync-status { color: #475569; font-size: 0.9rem; margin-bottom: 0.5rem; }
</style>