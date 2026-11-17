<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { usePlints, type PlintRecord } from '@/composables/usePlints'
import { useAuth } from '@/composables/useAuth'
import { syncAll } from '@/sync/engine'
import { db } from '@/db'
import { countCascade, cascadeDelete, cascadeConfirmText } from '@/utils/cascade'

const route = useRoute()
const boxId = route.params.boxId as string
const boxNumber = ref('')
const rackId = ref('')
const rackName = ref('')
const cabinetId = ref('')
const cabinetName = ref('')
const objectId = ref('')
const objectName = ref('')

const crud = usePlints()
const { isAdmin, isViewer, canEdit } = useAuth()
const form = ref({ number: '', type: '', pair_count: 10 })
const editingId = ref<string | null>(null)
const syncStatus = ref('')
const pendingCount = ref(0)
const selectedIds = ref<Set<string>>(new Set())

const filteredItems = computed(() =>
  crud.items.value.filter((p) => p.box === boxId)
)

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
    selectedIds.value = new Set(filteredItems.value.map((p) => p.id))
  }
}

async function refreshPending() {
  pendingCount.value = await db.outbox.where('status').equals('pending').count()
}

async function save() {
  if (!form.value.number.trim()) return
  if (editingId.value) {
    await crud.update(editingId.value, {
      number: form.value.number,
      type: form.value.type,
    })
    editingId.value = null
  } else {
    await crud.create({
      box: boxId,
      number: form.value.number,
      type: form.value.type,
      pair_count: form.value.pair_count,
    })
  }
  form.value = { number: '', type: '', pair_count: 10 }
  await refreshPending()
}

function edit(p: PlintRecord) {
  editingId.value = p.id
  form.value = { number: p.number, type: p.type || '', pair_count: p.pair_count }
}

function cancelEdit() {
  editingId.value = null
  form.value = { number: '', type: '', pair_count: 10 }
}

/** Каскадное удаление плинтов: пары → привязки пар → плинт, снизу вверх. */
async function deleteCascade(plintIds: string[]) {
  for (const plintId of plintIds) {
    await cascadeDelete('plints', plintId)
  }
}

async function remove(id: string) {
  if (!isAdmin.value) {
    alert('Удаление доступно только администратору.')
    return
  }
  const target = filteredItems.value.find((p) => p.id === id)
  const label = target ? `плинт «${target.number}»` : 'плинт'
  try {
    const stats = await countCascade('plints', id)
    if (!confirm(cascadeConfirmText(label, stats))) return
    await deleteCascade([id])
    await crud.load()
    await refreshPending()
  } catch (e: any) {
    alert(e.message)
  }
}

async function deleteSelected() {
  if (!isAdmin.value) {
    alert('Удаление доступно только администратору.')
    return
  }
  const ids = Array.from(selectedIds.value)
  if (ids.length === 0) return
  try {
    const stats = await countCascade('plints', ids[0])
    if (!confirm(cascadeConfirmText(`${ids.length} плинт(ов)`, stats))) return
    await deleteCascade(ids)
    selectedIds.value = new Set()
    await crud.load()
    await refreshPending()
  } catch (e: any) {
    alert(e.message)
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
  const box = await db.boxes.get(boxId)
  if (box) {
    boxNumber.value = box.number
    rackId.value = box.rack
    const rack = await db.racks.get(box.rack)
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
      <RouterLink v-if="rackId" :to="`/racks/${rackId}/boxes`">{{ rackName }}</RouterLink>
      /
      Бокс {{ boxNumber }}
    </p>

    <div class="header">
      <h2>Плинты бокса «{{ boxNumber }}»</h2>
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

    <p v-if="isViewer" class="readonly-hint">Режим просмотра: добавление и правка недоступны.</p>
    <p class="hint">
      При создании плинта автоматически создаётся N пар (по полю «Пар»).
      Количество пар нельзя изменить после создания.
    </p>

    <form v-if="canEdit" @submit.prevent="save" class="form">
      <input v-model="form.number" placeholder="Номер плинта *" required />
      <input v-model="form.type" placeholder="Тип (10-парный)" />
      <input
        v-model.number="form.pair_count"
        type="number"
        min="1"
        max="100"
        placeholder="Пар"
        :disabled="!!editingId"
        :title="editingId ? 'Количество пар нельзя изменить после создания' : ''"
      />
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
          <th>Пар</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in filteredItems" :key="p.id">
          <td class="col-select">
            <input
              type="checkbox"
              :checked="selectedIds.has(p.id)"
              @change="toggleSelect(p.id)"
              :disabled="!isAdmin"
            />
          </td>
          <td>
            <RouterLink :to="`/plints/${p.id}/pairs`" class="plint-link">{{ p.number }}</RouterLink>
          </td>
          <td>{{ p.type }}</td>
          <td>{{ p.pair_count }}</td>
          <td class="row-actions">
            <button v-if="canEdit" @click="edit(p)">✏️</button>
            <button v-if="isAdmin" class="delete-btn" title="Удалить со всем содержимым" @click="remove(p.id)">🗑️</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>Нет плинтов. Добавьте первый.</p>
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
.hint { color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem; }
.form { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
.form input { padding: 0.4rem; border: 1px solid #ccc; border-radius: 6px; }
.form input:disabled { background: #f1f5f9; color: #94a3b8; }
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
.plint-link { color: #1e40af; text-decoration: none; }
.plint-link:hover { text-decoration: underline; }
.sync-status { color: #475569; font-size: 0.9rem; margin-bottom: 0.5rem; }
.readonly-hint { color: #94a3b8; font-size: 0.85rem; font-style: italic; margin-bottom: 0.5rem; }
</style>