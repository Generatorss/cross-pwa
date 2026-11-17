import { pb, pbUrlMissing } from '@/api/pocketbase'
import { db, type OutboxItem } from '@/db'

export async function pushOutbox(): Promise<{ synced: number; failed: number }> {
  const pending = await db.outbox.where('status').equals('pending').toArray()
  let synced = 0
  let failed = 0

  for (const item of pending) {
    try {
      if (item.operation === 'create') {
        await pb.collection(item.collection).create(item.payload)
      } else if (item.operation === 'update') {
        await pb.collection(item.collection).update(item.recordId, item.payload)
      } else if (item.operation === 'delete') {
        try {
          await pb.collection(item.collection).delete(item.recordId)
        } catch (e: any) {
          if (e?.status !== 404) throw e
        }
      }
      await db.outbox.update(item.id!, { status: 'synced' })
      synced++
    } catch (e) {
      console.error(`push failed [${item.collection}/${item.operation}]`, e, item)
      failed++
    }
  }

  await db.outbox.where('status').equals('synced').delete()
  return { synced, failed }
}

export async function pullChanges(collection: string, checkpointKey: string): Promise<number> {
  // Полный список с сервера — нужен для обнаружения удалений.
  const serverRecords = await pb.collection(collection).getFullList()
  const serverIds = new Set(serverRecords.map((r: any) => r.id))

  // Записи с pending в outbox не трогаем — их судьба решается на push.
  const pendingItems = await db.outbox.where('status').equals('pending').toArray()
  const pendingIds = new Set(
    pendingItems.filter((p) => p.collection === collection).map((p) => p.recordId)
  )

  // 1) Upsert: то, что есть на сервере, сохраняем локально (обновляем или создаём).
  for (const rec of serverRecords) {
    await db.table(collection).put(rec)
  }

  // 2) Reconcile: удаляем локальные записи, которых нет на сервере,
  //    но только если по ним нет pending-операции в outbox.
  const localRecords = await db.table(collection).toArray()
  let deleted = 0
  for (const local of localRecords) {
    if (!serverIds.has(local.id) && !pendingIds.has(local.id)) {
      await db.table(collection).delete(local.id)
      deleted++
    }
  }

  // checkpointKey оставлен для совместимости — можно использовать для метрик.
  await db.meta.put({ key: checkpointKey, value: new Date().toISOString() })

  return serverRecords.length
}

const COLLECTIONS = [
  'objects', 'cabinets', 'racks', 'boxes', 'plints', 'pairs',
  'cables', 'cores', 'cross_connections', 'local_equipment',
  'lines', 'fault_types', 'faults',
] as const

export async function syncAll(): Promise<{ pushed: number; pulled: number; failed: number }> {
  if (pbUrlMissing) {
    throw new Error('VITE_PB_URL не задан — укажите адрес PocketBase в .env (см. .env.example)')
  }
  if (!pb.authStore.isValid) {
    throw new Error('Требуется авторизация')
  }
  const pushResult = await pushOutbox()
  let pulled = 0
  let pullFailed = 0
  for (const col of COLLECTIONS) {
    try {
      pulled += await pullChanges(col, `sync_${col}`)
    } catch (e) {
      console.error(`pull failed for ${col}`, e)
      pullFailed++
    }
  }
  return { pushed: pushResult.synced, pulled, failed: pushResult.failed + pullFailed }
}