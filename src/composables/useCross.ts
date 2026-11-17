import { ref } from 'vue'
import { db, type OutboxItem } from '@/db'
import { generatePbId } from '@/utils/id'

export interface CrossInput {
  from_pair: string
  from_wire?: 'A' | 'B' | null
  to_pair?: string | null
  to_wire?: 'A' | 'B' | null
  to_foreign_cable_name?: string
  connection_type: string
  description?: string
  line?: string | null
}

/** Управление кроссовыми соединениями конкретной пары (обе стороны). */
export function useCross(pairId: string) {
  const connections = ref<any[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      const [asFrom, asTo] = await Promise.all([
        db.cross_connections.where('from_pair').equals(pairId).toArray(),
        db.cross_connections.where('to_pair').equals(pairId).toArray(),
      ])
      connections.value = [...asFrom, ...asTo]
    } finally {
      loading.value = false
    }
  }

  async function create(data: CrossInput) {
    const id = generatePbId()
    const now = new Date().toISOString()
    const payload: any = {
      from_pair: data.from_pair,
      from_wire: data.from_wire || null,
      to_pair: data.to_pair || null,
      to_wire: data.to_wire || null,
      to_foreign_cable_name: data.to_foreign_cable_name || '',
      connection_type: data.connection_type,
      description: data.description || '',
      line: data.line || null,
    }
    const record = { ...payload, id, created: now, updated: now }
    await db.cross_connections.put(record)
    await db.outbox.add({
      collection: 'cross_connections',
      recordId: id,
      operation: 'create',
      payload: { ...payload, id },
      clientUpdatedAt: now,
      status: 'pending',
    } as OutboxItem)
    await load()
    return record
  }

  async function remove(id: string) {
    const now = new Date().toISOString()
    await db.cross_connections.delete(id)
    await db.outbox.add({
      collection: 'cross_connections',
      recordId: id,
      operation: 'delete',
      payload: { id },
      clientUpdatedAt: now,
      status: 'pending',
    } as OutboxItem)
    await load()
  }

  return { connections, loading, load, create, remove }
}
