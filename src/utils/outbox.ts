import { db, type OutboxItem } from '@/db'

export async function enqueueDelete(collection: string, id: string, now = new Date().toISOString()) {
  const pendingOps = await db.outbox
    .where('status')
    .equals('pending')
    .and((item) => item.collection === collection && item.recordId === id)
    .toArray()

  // Удаляем все pending-операции по этой записи (create/update/delete)
  for (const op of pendingOps) {
    if (op.id) await db.outbox.delete(op.id)
  }

  // Всегда ставим DELETE. Если записи на сервере нет — 404 будет проигнорирован.
  await db.outbox.add({
    collection,
    recordId: id,
    operation: 'delete',
    payload: { id },
    clientUpdatedAt: now,
    status: 'pending',
  } as OutboxItem)
}

/**
 * Ставит в очередь update-операцию (например, отвязку связи при каскадном удалении).
 * Если запись уже помечена к удалению — update не нужен, пропускаем.
 */
export async function enqueueUpdate(
  collection: string,
  id: string,
  patch: Record<string, any>,
  now = new Date().toISOString()
) {
  const hasPendingDelete = await db.outbox
    .where('status')
    .equals('pending')
    .and(
      (item) =>
        item.collection === collection && item.recordId === id && item.operation === 'delete'
    )
    .count()
  if (hasPendingDelete) return

  await db.outbox.add({
    collection,
    recordId: id,
    operation: 'update',
    payload: { ...patch },
    clientUpdatedAt: now,
    status: 'pending',
  } as OutboxItem)
}