<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { db } from '@/db'

interface PairRecord {
  id: string
  plint: string
  pair_number: number
  label?: string
}

const route = useRoute()
const pairId = route.params.pairId as string
const pair = ref<PairRecord | null>(null)
const plintNumber = ref('')
const boxNumber = ref('')
const rackName = ref('')
const cabinetName = ref('')
const objectName = ref('')
const objectId = ref('')
const cabinetId = ref('')
const rackId = ref('')
const boxId = ref('')
const plintId = ref('')

onMounted(async () => {
  const p = await db.pairs.get(pairId)
  if (!p) return
  pair.value = p
  plintId.value = p.plint

  const plint = await db.plints.get(p.plint)
  if (!plint) return
  plintNumber.value = plint.number
  boxId.value = plint.box

  const box = await db.boxes.get(plint.box)
  if (!box) return
  boxNumber.value = box.number
  rackId.value = box.rack

  const rack = await db.racks.get(box.rack)
  if (!rack) return
  rackName.value = rack.name
  cabinetId.value = rack.cabinet

  const cabinet = await db.cabinets.get(rack.cabinet)
  if (!cabinet) return
  cabinetName.value = cabinet.name
  objectId.value = cabinet.object

  const obj = await db.objects.get(cabinet.object)
  objectName.value = obj?.name || '—'
})
</script>

<template>
  <section v-if="pair">
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
      <RouterLink :to="`/plints/${plintId}/pairs`">Плинт {{ plintNumber }}</RouterLink>
      /
      Пара {{ pair.pair_number }}
    </p>

    <h2>Пара {{ pair.pair_number }} плинта «{{ plintNumber }}»</h2>
    <p class="meta">Метка: <strong>{{ pair.label || '—' }}</strong></p>
    <p class="meta">ID пары: <code>{{ pair.id }}</code></p>

    <div class="placeholder">
      <h3>Кроссовые соединения</h3>
      <p>Здесь появится блок управления кроссами (Шаг 9).</p>
    </div>
  </section>
  <section v-else>
    <p>Загрузка…</p>
  </section>
</template>

<style scoped>
.breadcrumb { color: #64748b; font-size: 0.9rem; margin-bottom: 0.5rem; }
.breadcrumb a { color: #1e40af; text-decoration: none; }
.meta { color: #475569; font-size: 0.9rem; margin-bottom: 0.3rem; }
.meta code { background: #f1f5f9; padding: 0.1rem 0.3rem; border-radius: 3px; }
.placeholder {
  margin-top: 1.5rem;
  padding: 1rem;
  border: 2px dashed #cbd5e1;
  border-radius: 8px;
  color: #64748b;
}
.placeholder h3 { margin-bottom: 0.5rem; color: #334155; }
</style>