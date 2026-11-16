import { ref } from 'vue'
import { db, type OutboxItem } from '@/db'

function generatePbId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(15))
  let id = ''
  for (let i = 0; i < 15; i++) id += chars[bytes[i] % 36]
  return id
}

export function useCrud<T extends { id: string }>(collection: string) {
  const items = ref<T[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      items.value = (await db.table(collection).toArray()) as T[]
    } finally {
      loading.value = false
    }
  }

  async function create(data: Omit<T, 'id'>) {
    const id = generatePbId()
    const now = new Date().toISOString()
    const record = { ...data, id, created: now, updated: now } as unknown as T
    await db.table(collection).put(record)
    await db.outbox.add({
      collection,
      recordId: id,
      operation: 'create',
      payload: { ...data, id },
      clientUpdatedAt: now,
      status: 'pending',
    } as OutboxItem)
    await load()
    return record
  }

  async function update(id: string, patch: Partial<T>) {
    const now = new Date().toISOString()
    await db.table(collection).update(id, { ...patch, updated: now })
    await db.outbox.add({
      collection,
      recordId: id,
      operation: 'update',
      payload: { ...patch },
      clientUpdatedAt: now,
      status: 'pending',
    } as OutboxItem)
    await load()
  }

  async function remove(id: string) {
    const now = new Date().toISOString()
    await db.table(collection).delete(id)
    await db.outbox.add({
      collection,
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