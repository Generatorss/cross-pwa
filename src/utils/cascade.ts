import { db } from '@/db'
import { enqueueDelete, enqueueUpdate } from './outbox'

/**
 * Каскадное удаление сверху вниз: объект → шкаф → стойка → бокс → плинт → пара.
 * Внутри выполняется строго снизу вверх (сначала дети, потом родитель),
 * поэтому на сервере записи всегда удаляются в безопасном порядке.
 *
 * Вместе с парами удаляются их привязки:
 *  - cross_connections (соединения, где пара участвует любой из сторон);
 *  - faults (неисправности пары);
 *  - local_equipment.connected_pair — отвязывается (оборудование остаётся).
 *
 * При удалении объекта:
 *  - local_equipment этого объекта удаляется (связь обязательная);
 *  - кабели с from_object/to_object = объект — отвязываются (остаются в справочнике).
 */

export interface CascadeStats {
  cabinets: number
  racks: number
  boxes: number
  plints: number
  pairs: number
  cross_connections: number
  faults: number
  local_equipment: number
  cables_unlinked: number
  equipment_unlinked: number
}

const emptyStats = (): CascadeStats => ({
  cabinets: 0,
  racks: 0,
  boxes: 0,
  plints: 0,
  pairs: 0,
  cross_connections: 0,
  faults: 0,
  local_equipment: 0,
  cables_unlinked: 0,
  equipment_unlinked: 0,
})

// Куда спускаться по структуре и по какому полю искать детей
const CHILD: Record<string, { child: string; fk: string }> = {
  objects: { child: 'cabinets', fk: 'object' },
  cabinets: { child: 'racks', fk: 'cabinet' },
  racks: { child: 'boxes', fk: 'rack' },
  boxes: { child: 'plints', fk: 'box' },
  plints: { child: 'pairs', fk: 'plint' },
}

const LABELS: Array<[keyof CascadeStats, string]> = [
  ['cabinets', 'шкафов'],
  ['racks', 'стоек'],
  ['boxes', 'боксов'],
  ['plints', 'плинтов'],
  ['pairs', 'пар'],
  ['cross_connections', 'кроссовых соединений'],
  ['faults', 'неисправностей'],
  ['local_equipment', 'оборудования'],
  ['equipment_unlinked', 'оборудования (отвязано)'],
  ['cables_unlinked', 'кабелей (отвязано)'],
]

/** Подсчёт всего, что будет удалено/отвязано (без изменений данных). */
export async function countCascade(collection: string, id: string): Promise<CascadeStats> {
  const stats = emptyStats()
  await collect(collection, id, stats, new Set(), new Set(), new Set())
  return stats
}

/**
 * Подсчёт для массового удаления: суммарная статистика по всем выбранным узлам.
 * Множества дедупликации общие, поэтому соединение двух выбранных пар
 * или общие потомки не считаются дважды.
 */
export async function countCascadeMany(
  collection: string,
  ids: string[]
): Promise<CascadeStats> {
  const stats = emptyStats()
  const seen = new Set<string>()
  const countedCross = new Set<string>()
  const deletedObjects = new Set<string>()
  for (const id of ids) {
    await collect(collection, id, stats, seen, countedCross, deletedObjects)
  }
  return stats
}

async function collect(
  collection: string,
  id: string,
  stats: CascadeStats,
  seen: Set<string>,
  countedCross: Set<string>,
  deletedObjects: Set<string>
) {
  const key = `${collection}/${id}`
  if (seen.has(key)) return
  seen.add(key)

  if (collection === 'objects') {
    deletedObjects.add(id)
  }

  const link = CHILD[collection]
  if (link) {
    const children = await db.table(link.child).where(link.fk).equals(id).toArray()
    stats[link.child as keyof CascadeStats] += children.length
    for (const ch of children) await collect(link.child, ch.id, stats, seen, countedCross, deletedObjects)
  }

  if (collection === 'pairs') {
    // Кроссы считаем по уникальным id — соединение двух удаляемых пар нельзя считать дважды.
    const cross = await db.cross_connections.where('from_pair').equals(id).toArray()
    const crossTo = await db.cross_connections.where('to_pair').equals(id).toArray()
    for (const c of [...cross, ...crossTo]) {
      if (!countedCross.has(c.id)) {
        countedCross.add(c.id)
        stats.cross_connections++
      }
    }
    stats.faults += await db.faults.where('pair').equals(id).count()
    // Оборудование, висящее на паре: отвяжется, если его объект не удаляется вместе с нами.
    const equipment = await db.local_equipment.where('connected_pair').equals(id).toArray()
    stats.equipment_unlinked += equipment.filter((e) => !deletedObjects.has(e.object)).length
  }

  if (collection === 'objects') {
    stats.local_equipment += await db.local_equipment.where('object').equals(id).count()
    stats.cables_unlinked += await db.cables.where('from_object').equals(id).count()
    stats.cables_unlinked += (await db.cables.where('to_object').equals(id).toArray())
      .filter((c) => c.from_object !== id).length
  }
}

/** Текст для confirm() перед каскадным удалением. */
export function cascadeConfirmText(entityLabel: string, stats: CascadeStats): string {
  const rows = LABELS
    .map(([key, label]) => ({ v: stats[key], label }))
    .filter((r) => r.v > 0)
    .map((r) => `${r.label} — ${r.v}`)
  const body = rows.length ? rows.join(', ') : 'вложенных записей нет'
  return (
    `Удалить ${entityLabel} вместе со всем содержимым?\n\n` +
    `Затронуто записей: ${body}.\n` +
    `Удаление выполняется снизу вверх и синхронизируется с сервером. Отменить будет нельзя.`
  )
}

/** Каскадное удаление узла со всеми детьми и привязками. Возвращает статистику. */
export async function cascadeDelete(
  collection: string,
  id: string,
  now = new Date().toISOString()
): Promise<CascadeStats> {
  const stats = emptyStats()
  await cascadeNode(collection, id, now, stats, new Set())
  return stats
}

async function cascadeNode(
  collection: string,
  id: string,
  now: string,
  stats: CascadeStats,
  seen: Set<string>
) {
  const key = `${collection}/${id}`
  if (seen.has(key)) return
  seen.add(key)

  // 1) Дети — рекурсивно, самые глубокие в первую очередь.
  const link = CHILD[collection]
  if (link) {
    const children = await db.table(link.child).where(link.fk).equals(id).toArray()
    for (const ch of children) await cascadeNode(link.child, ch.id, now, stats, seen)
  }

  // 2) Привязки самого узла.
  if (collection === 'pairs') {
    const cross = await db.cross_connections.where('from_pair').equals(id).toArray()
    const crossTo = await db.cross_connections.where('to_pair').equals(id).toArray()
    const crossIds = new Set([...cross, ...crossTo].map((c) => c.id))
    for (const cid of crossIds) {
      await db.cross_connections.delete(cid)
      await enqueueDelete('cross_connections', cid, now)
    }
    stats.cross_connections += crossIds.size

    const faults = await db.faults.where('pair').equals(id).toArray()
    for (const f of faults) {
      await db.faults.delete(f.id)
      await enqueueDelete('faults', f.id, now)
    }
    stats.faults += faults.length

    const equipment = await db.local_equipment.where('connected_pair').equals(id).toArray()
    for (const e of equipment) {
      await db.local_equipment.update(e.id, { connected_pair: '', updated: now })
      await enqueueUpdate('local_equipment', e.id, { connected_pair: '' }, now)
    }
    stats.equipment_unlinked += equipment.length
  }

  if (collection === 'objects') {
    const equipment = await db.local_equipment.where('object').equals(id).toArray()
    for (const e of equipment) {
      await db.local_equipment.delete(e.id)
      await enqueueDelete('local_equipment', e.id, now)
    }
    stats.local_equipment += equipment.length

    const cablesFrom = await db.cables.where('from_object').equals(id).toArray()
    for (const c of cablesFrom) {
      await db.cables.update(c.id, { from_object: '', updated: now })
      await enqueueUpdate('cables', c.id, { from_object: '' }, now)
    }
    const cablesTo = (await db.cables.where('to_object').equals(id).toArray())
      .filter((c) => c.from_object !== id)
    for (const c of cablesTo) {
      await db.cables.update(c.id, { to_object: '', updated: now })
      await enqueueUpdate('cables', c.id, { to_object: '' }, now)
    }
    stats.cables_unlinked += cablesFrom.length + cablesTo.length
  }

  // 3) Сам узел — последним.
  await db.table(collection).delete(id)
  await enqueueDelete(collection, id, now)
}
