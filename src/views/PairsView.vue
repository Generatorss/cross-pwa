<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { syncAll } from '@/sync/engine'
import { db, type OutboxItem } from '@/db'
import { useAuth } from '@/composables/useAuth'
import { countCascade, cascadeDelete, cascadeConfirmText } from '@/utils/cascade'

interface PairRecord {
  id: string
  plint: string
  pair_number: number
  label?: string
}

const route = useRoute()
const plintId = route.params.plintId as string
const { isAdmin } = useAuth()

const plintNumber = ref('')
const plintType = ref('')
const plintPairCount = ref(0)
const boxId = ref('')
const boxNumber = ref('')
const rackId = ref('')
const rackName = ref('')
const cabinetId = ref('')
const cabinetName = ref('')
const objectId = ref('')
const objectName = ref('')

const pairs = ref<PairRecord[]>([])
const loading = ref(false)
const syncStatus = ref('')
const pendingCount = ref(0)
const selectedIds = ref<Set<string>>(new Set())

const sortedPairs = computed(() =>
  [...pairs.value].sort((a, b) => a.pair_number - b.pair_number)
)

const allSelected = computed(
  () => sortedPairs.value.length > 0 && selectedIds.value.size === sortedPairs.value.length
)
const someSelected = computed(
  () => selectedIds.value.size > 0 && selectedIds.value.size < sortedPairs.value.length
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
    selectedIds.value = new Set(sortedPairs.value.map((p) => p.id))
  }
}

async function refreshPending() {
  pendingCount.value = await db.outbox.where('status').equals('pending').count()
}

async function loadPairs() {
  loading.value = true
  try {
    pairs.value = await db.pairs.where('plint').equals(plintId).toArray()
  } finally {
    loading.value = false
  }
}

async function removePair(id: string) {
  if (!isAdmin.value) {
    alert('Удаление доступно только администратору.')
    return
  }
  const pair = pairs.value.find((p) => p.id === id)
  const labelText = pair ? `${pair.label} (№${pair.pair_number})` : id
  try {
    const stats = await countCascade('pairs', id)
    if (!confirm(cascadeConfirmText(`пару ${labelText}`, stats))) return
    await cascadeDelete('pairs', id)
    const next = new Set(selectedIds.value)
    next.delete(id)
    selectedIds.value = next
    await loadPairs()
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

  try {
    const stats = await countCascade('pairs', ids[0])
    if (!confirm(cascadeConfirmText(`${ids.length} пар(ы)`, stats))) return
    await cascadeDelete('pairs', ids[0])
    for (const id of ids.slice(1)) {
      await cascadeDelete('pairs', id)
    }
    selectedIds.value = new Set()
    await loadPairs()
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
    await loadPairs()
    await refreshPending()
  } catch (e: any) {
    syncStatus.value = `Ошибка: ${e.message}`
  }
}

onMounted(async () => {
  await loadPairs()
  await refreshPending()

  const plint = await db.plints.get(plintId)
  if (!plint) return

  plintNumber.value = plint.number
  plintType.value = plint.type || ''
  plintPairCount.value = plint.pair_count

  boxId.value = plint.box
  const box = await db.boxes.get(plint.box)
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
      <RouterLink v-if="boxId" :to="`/boxes/${boxId}/plints`">Бокс {{ boxNumber }}</RouterLink>
      /
      Плинт {{ plintNumber }}
    </p>

    <div class="header">
      <h2>Пары плинта «{{ plintNumber }}» <span class="sub">{{ plintType }}</span></h2>
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

    <p class="hint">
      Всего пар: <strong>{{ plintPairCount }}</strong>.
      Пары генерируются автоматически при создании плинта.
    </p>

    <table v-if="sortedPairs.length">
      <thead>
        <tr>
          <th v-if="isAdmin" class="col-select">
            <input
              type="checkbox"
              :checked="allSelected"
              :indeterminate="someSelected"
              @change="toggleSelectAll"
            />
          </th>
          <th>№</th>
          <th>Метка</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in sortedPairs" :key="p.id">
          <td v-if="isAdmin" class="col-select">
            <input
              type="checkbox"
              :checked="selectedIds.has(p.id)"
              @change="toggleSelect(p.id)"
            />
          </td>
          <td>{{ p.pair_number }}</td>
          <td>{{ p.label || '—' }}</td>
          <td class="row-actions">
            <RouterLink :to="`/pairs/${p.id}`" class="pair-link">Открыть →</RouterLink>
            <button
              v-if="isAdmin"
              class="delete-btn"
              title="Удалить (вместе с кроссами и неисправностями пары)"
              @click="removePair(p.id)"
            >🗑️</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else-if="!loading">Нет пар. Возможно, плинт был создан до автогенерации.</p>
    <p v-else>Загрузка…</p>
  </section>
</template>

<style scoped>
.breadcrumb { color: #64748b; font-size: 0.9rem; margin-bottom: 0.5rem; }
.breadcrumb a { color: #1e40af; text-decoration: none; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem; }
.sub { color: #94a3b8; font-size: 0.85rem; font-weight: normal; margin-left: 0.5rem; }
.actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.actions button { padding: 0.4rem 0.8rem; border: 1px solid #ccc; background: #fff; border-radius: 6px; cursor: pointer; }
.actions button.danger { background: #dc2626; color: #fff; border-color: #dc2626; }
.actions button.danger:hover { background: #b91c1c; }
.badge { background: #fbbf24; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.85rem; }
.hint { color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem; }
table { width: 100%; border-collapse: collapse; }
th, td { border-bottom: 1px solid #e5e7eb; padding: 0.5rem; text-align: left; }
th { background: #f8fafc; font-weight: 600; }
.col-select { width: 32px; text-align: center; }
.col-select input { cursor: pointer; }
.row-actions { white-space: nowrap; display: flex; gap: 0.75rem; align-items: center; }
.pair-link { color: #1e40af; text-decoration: none; }
.pair-link:hover { text-decoration: underline; }
.delete-btn { border: none; background: none; cursor: pointer; font-size: 1.1rem; padding: 0.2rem; border-radius: 4px; }
.delete-btn:hover { background: #fee2e2; }
.sync-status { color: #475569; font-size: 0.9rem; margin-bottom: 0.5rem; }
</style>