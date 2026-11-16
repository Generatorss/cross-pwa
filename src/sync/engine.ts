import { pb } from '@/api/pocketbase'
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
        await pb.collection(item.collection).delete(item.recordId)
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
  const meta = await db.meta.get(checkpointKey)
  const checkpoint = meta?.value || '1970-01-01 00:00:00.000Z'

  const records = await pb.collection(collection).getFullList({
    filter: `updated > "${checkpoint}"`,
    sort: 'updated',
  })

  for (const rec of records) {
    await db.table(collection).put(rec)
  }
  if (records.length > 0) {
    await db.meta.put({ key: checkpointKey, value: records[records.length - 1].updated })
  }
  return records.length
}

const COLLECTIONS = [
  'objects', 'cabinets', 'racks', 'boxes', 'plints', 'pairs',
  'cables', 'cores', 'cross_connections', 'local_equipment',
] as const

export async function syncAll(): Promise<{ pushed: number; pulled: number; failed: number }> {
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