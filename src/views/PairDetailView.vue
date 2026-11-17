<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { db } from '@/db'
import { useAuth } from '@/composables/useAuth'
import { useCross } from '@/composables/useCross'
import { resolvePairContext, ctxLabel, type PairContext } from '@/utils/resolve'

const route = useRoute()
const pairId = route.params.pairId as string
const { isAdmin, canEdit } = useAuth()

const pair = ref<any>(null)
const ctx = ref<PairContext | null>(null)
const plintNumber = ref('')
const lineName = ref('')
const cableConnected = ref(false)

// ---- кроссовые соединения ----
const cross = useCross(pairId)
const rowLabels = ref<Record<string, string>>({})

const sortedRows = computed(() =>
  [...cross.connections.value].sort((a, b) => (a.created || '').localeCompare(b.created || ''))
)

async function resolveRows() {
  const map: Record<string, string> = {}
  for (const c of cross.connections.value) {
    if (c.to_foreign_cable_name && !c.to_pair) {
      map[c.id] = `Внешний кабель «${c.to_foreign_cable_name}»`
    } else {
      const otherPairId = c.from_pair === pairId ? c.to_pair : c.from_pair
      const otherCtx = otherPairId ? await resolvePairContext(otherPairId) : null
      map[c.id] = ctxLabel(otherCtx)
    }
  }
  rowLabels.value = map
}

// ---- форма создания ----
const showForm = ref(false)
const form = ref({
  connectionType: '',
  fromWire: 'A' as 'A' | 'B',
  mode: 'pair' as 'pair' | 'foreign',
  foreignName: '',
  description: '',
  lineId: '',
  toWire: 'A' as 'A' | 'B',
  tObjectId: '',
  tCabinetId: '',
  tRackId: '',
  tBoxId: '',
  tPlintId: '',
  tPairId: '',
})

const connTypes = ['кросс', 'прямое', 'резерв', 'параллель']
const lines = ref<any[]>([])
const objectsAll = ref<any[]>([])
const cabinetsAll = ref<any[]>([])
const racksAll = ref<any[]>([])
const boxesAll = ref<any[]>([])

const cabinetsList = computed(() =>
  cabinetsAll.value.filter((c) => c.object === form.value.tObjectId).sort((a, b) => a.name.localeCompare(b.name))
)
const racksList = computed(() =>
  racksAll.value.filter((r) => r.cabinet === form.value.tCabinetId).sort((a, b) => a.name.localeCompare(b.name))
)
const boxesList = computed(() =>
  boxesAll.value.filter((b) => b.rack === form.value.tRackId).sort((a, b) => String(a.number).localeCompare(String(b.number)))
)
const plintsItems = ref<any[]>([])
const pairsItems = ref<any[]>([])

async function reloadPlints() {
  plintsItems.value = form.value.tBoxId
    ? (await db.plints.where('box').equals(form.value.tBoxId).toArray()).sort((a: any, b: any) => String(a.number).localeCompare(String(b.number)))
    : []
}
async function reloadPairs() {
  pairsItems.value = form.value.tPlintId
    ? (await db.pairs.where('plint').equals(form.value.tPlintId).toArray())
        .filter((p: any) => p.id !== pairId)
        .sort((a: any, b: any) => a.pair_number - b.pair_number)
    : []
}

const targetLabel = computed(() => {
  if (form.value.mode !== 'pair' || !form.value.tPairId) return ''
  const pairRow = pairsItems.value.find((p) => p.id === form.value.tPairId)
  const plintRow = plintsItems.value.find((p) => p.id === form.value.tPlintId)
  const boxRow = boxesList.value.find((b) => b.id === form.value.tBoxId)
  const rackRow = racksList.value.find((r) => r.id === form.value.tRackId)
  const cabinetRow = cabinetsList.value.find((c) => c.id === form.value.tCabinetId)
  const objRow = objectsAll.value.find((o) => o.id === form.value.tObjectId)
  return [
    objRow?.name,
    cabinetRow?.name,
    rackRow?.name,
    boxRow ? `Бокс ${boxRow.number}` : '',
    plintRow ? `Плинт ${plintRow.number}` : '',
    pairRow ? `Пара ${pairRow.pair_number}` : '',
  ].filter(Boolean).join(' / ')
})

function resetCascade(level: 'object' | 'cabinet' | 'rack' | 'box' | 'plint') {
  if (level === 'object') {
    form.value.tCabinetId = ''
  }
  if (level === 'object' || level === 'cabinet') {
    form.value.tRackId = ''
  }
  if (level === 'object' || level === 'cabinet' || level === 'rack') {
    form.value.tBoxId = ''
  }
  if (level === 'object' || level === 'cabinet' || level === 'rack' || level === 'box') {
    form.value.tPlintId = ''
    plintsItems.value = []
  }
  form.value.tPairId = ''
  pairsItems.value = []
  if (level === 'box') reloadPlints()
  if (level === 'plint') { reloadPlints(); reloadPairs() }
}

function resetForm() {
  form.value = {
    connectionType: '',
    fromWire: 'A',
    mode: 'pair',
    foreignName: '',
    description: '',
    lineId: pair.value?.line || '',
    toWire: 'A',
    tObjectId: '',
    tCabinetId: '',
    tRackId: '',
    tBoxId: '',
    tPlintId: '',
    tPairId: '',
  }
  plintsItems.value = []
  pairsItems.value = []
  showForm.value = false
}

async function save() {
  const f = form.value
  if (!f.connectionType.trim()) {
    alert('Укажите тип соединения.')
    return
  }
  if (f.mode === 'pair') {
    if (!f.tPairId) {
      alert('Выберите пару для соединения (заполните каскад до конца).')
      return
    }
    if (f.tPairId === pairId) {
      alert('Нельзя соединить пару с самой собой.')
      return
    }
    const dup = cross.connections.value.find((c: any) =>
      (c.from_pair === pairId && c.to_pair === f.tPairId &&
        (c.from_wire || null) === (f.fromWire || null) && (c.to_wire || null) === (f.toWire || null)) ||
      (c.to_pair === pairId && c.from_pair === f.tPairId &&
        (c.to_wire || null) === (f.fromWire || null) && (c.from_wire || null) === (f.toWire || null))
    )
    if (dup) {
      alert('Такое соединение уже существует.')
      return
    }
    await cross.create({
      from_pair: pairId,
      from_wire: f.fromWire,
      to_pair: f.tPairId,
      to_wire: f.toWire,
      connection_type: f.connectionType.trim(),
      description: f.description.trim(),
      line: f.lineId || null,
    })
  } else {
    if (!f.foreignName.trim()) {
      alert('Укажите название внешнего кабеля.')
      return
    }
    await cross.create({
      from_pair: pairId,
      from_wire: f.fromWire,
      to_foreign_cable_name: f.foreignName.trim(),
      connection_type: f.connectionType.trim(),
      description: f.description.trim(),
      line: f.lineId || null,
    })
  }
  await resolveRows()
  resetForm()
}

async function removeConnection(c: any) {
  if (!isAdmin.value) {
    alert('Удаление доступно только администратору.')
    return
  }
  const label = rowLabels.value[c.id] || c.id
  if (!confirm(`Удалить соединение с «${label}»?`)) return
  await cross.remove(c.id)
  await resolveRows()
}

// ---- загрузка ----
onMounted(async () => {
  const p = await db.pairs.get(pairId)
  if (!p) return
  pair.value = p
  cableConnected.value = !!p.cable_connected
  if (p.line) {
    const l = await db.lines.get(p.line)
    lineName.value = l?.name || ''
  }

  ctx.value = await resolvePairContext(pairId)
  plintNumber.value = ctx.value?.plint?.number || ''

  lines.value = (await db.lines.toArray()).sort((a: any, b: any) => a.name.localeCompare(b.name))
  objectsAll.value = (await db.objects.toArray()).sort((a: any, b: any) => a.name.localeCompare(b.name))
  cabinetsAll.value = await db.cabinets.toArray()
  racksAll.value = await db.racks.toArray()
  boxesAll.value = await db.boxes.toArray()

  await cross.load()
  await resolveRows()
})
</script>

<template>
  <section v-if="pair">
    <p class="breadcrumb">
      <RouterLink to="/objects">Объекты</RouterLink>
      /
      <RouterLink v-if="ctx?.object" :to="`/objects/${ctx.object.id}/cabinets`">{{ ctx.object.name }}</RouterLink>
      /
      <RouterLink v-if="ctx?.cabinet" :to="`/cabinets/${ctx.cabinet.id}/racks`">{{ ctx.cabinet.name }}</RouterLink>
      /
      <RouterLink v-if="ctx?.rack" :to="`/racks/${ctx.rack.id}/boxes`">{{ ctx.rack.name }}</RouterLink>
      /
      <RouterLink v-if="ctx?.box" :to="`/boxes/${ctx.box.id}/plints`">Бокс {{ ctx.box.number }}</RouterLink>
      /
      <RouterLink v-if="ctx?.plint" :to="`/plints/${ctx.plint.id}/pairs`">Плинт {{ ctx.plint.number }}</RouterLink>
      /
      Пара {{ pair.pair_number }}
    </p>

    <div class="header">
      <h2>Пара {{ pair.pair_number }} плинта «{{ plintNumber }}»</h2>
      <div class="actions" v-if="canEdit">
        <button v-if="!showForm" @click="showForm = true">Добавить соединение</button>
      </div>
    </div>

    <p class="meta">Метка: <strong>{{ pair.label || '—' }}</strong></p>
    <p class="meta">Линия: <strong>{{ lineName || '—' }}</strong></p>
    <p class="meta">Подключение кабеля: <strong>{{ cableConnected ? 'да' : 'нет' }}</strong></p>
    <p class="meta">ID пары: <code>{{ pair.id }}</code></p>

    <div class="cross-block">
      <h3>Кроссовые соединения</h3>
      <p class="hint">
        Пара может быть соединена с другой парой (сторона Б) или с внешним кабелем,
        которого нет в системе. Провода пары обозначены A и B.
      </p>

      <table v-if="sortedRows.length">
        <thead>
          <tr>
            <th>Соединена с</th>
            <th title="Провод стороны-источника → провод стороны-приёмника">Провода</th>
            <th>Тип</th>
            <th>Линия</th>
            <th>Описание</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in sortedRows" :key="c.id">
            <td>{{ rowLabels[c.id] || '…' }}</td>
            <td class="wires">{{ c.from_wire || '—' }} → {{ c.to_pair ? (c.to_wire || '—') : '—' }}</td>
            <td>{{ c.connection_type }}</td>
            <td>{{ (lines.find((l) => l.id === c.line) || {}).name || '—' }}</td>
            <td>{{ c.description || '—' }}</td>
            <td class="row-actions">
              <button
                v-if="isAdmin"
                class="delete-btn"
                title="Удалить соединение"
                @click="removeConnection(c)"
              >🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else-if="!cross.loading.value">Соединений нет.</p>
      <p v-else>Загрузка…</p>

      <!-- Форма создания -->
      <form v-if="showForm" class="cross-form" @submit.prevent="save">
        <h4>Новое соединение</h4>

        <div class="form-row">
          <label>
            Тип соединения *
            <input v-model="form.connectionType" list="conn-types" placeholder="кросс / прямое / резерв" required />
          </label>
          <label>
            Провод этой пары
            <select v-model="form.fromWire">
              <option value="A">A</option>
              <option value="B">B</option>
            </select>
          </label>
          <label>
            Линия
            <select v-model="form.lineId">
              <option value="">— не указана —</option>
              <option v-for="l in lines" :key="l.id" :value="l.id">{{ l.name }}</option>
            </select>
          </label>
        </div>

        <div class="mode-row">
          <label class="radio">
            <input v-model="form.mode" type="radio" value="pair" @change="resetCascade('object')" />
            С другой парой
          </label>
          <label class="radio">
            <input v-model="form.mode" type="radio" value="foreign" />
            С внешним кабелем
          </label>
        </div>

        <template v-if="form.mode === 'pair'">
          <div class="form-row">
            <label>
              Объект
              <select v-model="form.tObjectId" @change="resetCascade('object')">
                <option value="">— выберите —</option>
                <option v-for="o in objectsAll" :key="o.id" :value="o.id">{{ o.name }}</option>
              </select>
            </label>
            <label>
              Шкаф
              <select v-model="form.tCabinetId" :disabled="!form.tObjectId" @change="resetCascade('cabinet')">
                <option value="">— выберите —</option>
                <option v-for="c in cabinetsList" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </label>
            <label>
              Стойка
              <select v-model="form.tRackId" :disabled="!form.tCabinetId" @change="resetCascade('rack')">
                <option value="">— выберите —</option>
                <option v-for="r in racksList" :key="r.id" :value="r.id">{{ r.name }}</option>
              </select>
            </label>
          </div>
          <div class="form-row">
            <label>
              Бокс
              <select v-model="form.tBoxId" :disabled="!form.tRackId" @change="resetCascade('box')">
                <option value="">— выберите —</option>
                <option v-for="b in boxesList" :key="b.id" :value="b.id">{{ b.number }}</option>
              </select>
            </label>
            <label>
              Плинт
              <select v-model="form.tPlintId" :disabled="!form.tBoxId" @change="resetCascade('plint')">
                <option value="">— выберите —</option>
                <option v-for="p in plintsItems" :key="p.id" :value="p.id">{{ p.number }}</option>
              </select>
            </label>
            <label>
              Пара
              <select v-model="form.tPairId" :disabled="!form.tPlintId">
                <option value="">— выберите —</option>
                <option v-for="p in pairsItems" :key="p.id" :value="p.id">
                  №{{ p.pair_number }} ({{ p.label || 'без метки' }})
                </option>
              </select>
            </label>
            <label>
              Провод другой пары
              <select v-model="form.toWire">
                <option value="A">A</option>
                <option value="B">B</option>
              </select>
            </label>
          </div>
          <p v-if="targetLabel" class="target-preview">Сторона Б: {{ targetLabel }}</p>
        </template>

        <div v-else class="form-row">
          <label>
            Название внешнего кабеля *
            <input v-model="form.foreignName" placeholder="например, ТЛС-4 с объекта 3" />
          </label>
        </div>

        <div class="form-row">
          <label>
            Описание
            <input v-model="form.description" placeholder="необязательно" size="60" />
          </label>
        </div>

        <div class="form-buttons">
          <button type="submit" class="primary">Создать соединение</button>
          <button type="button" @click="resetForm">Отмена</button>
        </div>
      </form>

      <datalist id="conn-types">
        <option v-for="t in connTypes" :key="t" :value="t" />
      </datalist>
    </div>
  </section>
  <section v-else>
    <p>Загрузка…</p>
  </section>
</template>

<style scoped>
.breadcrumb { color: #64748b; font-size: 0.9rem; margin-bottom: 0.5rem; }
.breadcrumb a { color: #1e40af; text-decoration: none; }
.header { display: flex; justify-content: space-between; align-items: center; margin: 0.5rem 0 1rem; flex-wrap: wrap; gap: 0.5rem; }
.actions button { padding: 0.4rem 0.8rem; border: 1px solid #1e40af; background: #1e40af; color: #fff; border-radius: 6px; cursor: pointer; }
.actions button:hover { background: #1e3a8a; }
.meta { color: #475569; font-size: 0.9rem; margin-bottom: 0.3rem; }
.meta code { background: #f1f5f9; padding: 0.1rem 0.3rem; border-radius: 3px; }
.cross-block { margin-top: 1.5rem; }
.cross-block h3 { margin-bottom: 0.5rem; color: #334155; }
.hint { color: #64748b; font-size: 0.85rem; margin-bottom: 0.75rem; max-width: 800px; }
table { width: 100%; border-collapse: collapse; }
th, td { border-bottom: 1px solid #e5e7eb; padding: 0.5rem; text-align: left; }
th { background: #f8fafc; font-weight: 600; }
.wires { font-family: monospace; white-space: nowrap; }
.row-actions { white-space: nowrap; }
.delete-btn { border: none; background: none; cursor: pointer; font-size: 1.1rem; padding: 0.2rem; border-radius: 4px; }
.delete-btn:hover { background: #fee2e2; }
.cross-form {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  max-width: 900px;
}
.cross-form h4 { margin-bottom: 0.75rem; color: #334155; }
.form-row { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
.form-row label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: #475569; }
.form-row input, .form-row select {
  padding: 0.4rem; border: 1px solid #ccc; border-radius: 6px;
  font-size: 0.9rem; min-width: 140px;
}
.mode-row { display: flex; gap: 1.25rem; margin-bottom: 0.75rem; }
.mode-row .radio { display: flex; align-items: center; gap: 0.4rem; font-size: 0.9rem; color: #334155; }
.target-preview { color: #1e40af; font-size: 0.85rem; margin: 0 0 0.75rem; }
.form-buttons { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
.form-buttons button { padding: 0.45rem 0.9rem; border: 1px solid #ccc; background: #fff; border-radius: 6px; cursor: pointer; }
.form-buttons .primary { background: #1e40af; color: #fff; border-color: #1e40af; }
.form-buttons .primary:hover { background: #1e3a8a; }
</style>
