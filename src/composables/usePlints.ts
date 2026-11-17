import { ref } from 'vue'
import { db, type OutboxItem } from '@/db'
import { generatePbId } from '@/utils/id'

export interface PlintInput {
  box: string
  number: string
  type?: string
  pair_count: number
}

export interface PlintRecord extends PlintInput {
  id: string
  created: string
  updated: string
}

export function usePlints() {
  const items = ref<PlintRecord[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      items.value = (await db.plints.toArray()) as PlintRecord[]
    } finally {
      loading.value = false
    }
  }

  async function create(data: PlintInput) {
    const id = generatePbId()
    const now = new Date().toISOString()
    const record = { ...data, id, created: now, updated: now }
    await db.plints.put(record)
    await db.outbox.add({
      collection: 'plints',
      recordId: id,
      operation: 'create',
      payload: { ...data, id },
      clientUpdatedAt: now,
      status: 'pending',
    } as OutboxItem)

    // Считаем стартовый номер: max(pair_number) всех пар в этом боксе + 1
    // Если пар в боксе ещё нет — начинаем с 0.
    const plintsInBox = await db.plints.where('box').equals(data.box).toArray()
    const otherPlintIds = plintsInBox.map((p) => p.id).filter((pid) => pid !== id)
    let startNumber = 0
    if (otherPlintIds.length > 0) {
      const existingPairs = await db.pairs.where('plint').anyOf(otherPlintIds).toArray()
      if (existingPairs.length > 0) {
        startNumber = Math.max(...existingPairs.map((p) => p.pair_number)) + 1
      }
    }

    // Генерируем пары
    const pairCount = Math.max(1, Math.min(100, data.pair_count))
    for (let i = 0; i < pairCount; i++) {
      const pairId = generatePbId()
      const pairNumber = startNumber + i          // сквозной номер в боксе: 0, 1, 2, …
      const label = `${data.number}-${i}`         // человекочитаемая бирка: "1-0", "1-9"
      const pairRecord = {
        id: pairId,
        plint: id,
        pair_number: pairNumber,
        label,
        line: null,
        cable_connected: false,
        created: now,
        updated: now,
      }
      await db.pairs.put(pairRecord)
      await db.outbox.add({
        collection: 'pairs',
        recordId: pairId,
        operation: 'create',
        payload: {
          id: pairId,
          plint: id,
          pair_number: pairNumber,
          label,
          line: null,
          cable_connected: false,
        },
        clientUpdatedAt: now,
        status: 'pending',
      } as OutboxItem)
    }

    await load()
    return record
  }

  async function update(id: string, patch: Partial<PlintInput>) {
    const now = new Date().toISOString()
    await db.plints.update(id, { ...patch, updated: now })
    await db.outbox.add({
      collection: 'plints',
      recordId: id,
      operation: 'update',
      payload: { ...patch },
      clientUpdatedAt: now,
      status: 'pending',
    } as OutboxItem)
    await load()
  }

  async function remove(id: string) {
    const pairCount = await db.pairs.where('plint').equals(id).count()
    if (pairCount > 0) {
      throw new Error(
        `Нельзя удалить плинт: у него ${pairCount} пар. ` +
        `Сначала удалите пары.`
      )
    }
    const now = new Date().toISOString()
    await db.plints.delete(id)
    await db.outbox.add({
      collection: 'plints',
      recordId: id,
      operation: 'delete',
      payload: { id },
      clientUpdatedAt: now,
      status: 'pending',
    } as OutboxItem)
    await load()
  }

  return { items, loading, load, create, update, remove }
}