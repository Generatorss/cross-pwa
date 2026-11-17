import { db } from '@/db'

/** Полный контекст пары: вся иерархия от пары до объекта. */
export interface PairContext {
  pair: any
  plint?: any
  box?: any
  rack?: any
  cabinet?: any
  object?: any
}

/**
 * Поднимаемся по иерархии pair → plint → box → rack → cabinet → object.
 * Возвращает null, если пара не найдена в локальной базе.
 */
export async function resolvePairContext(pairId: string): Promise<PairContext | null> {
  const pair = await db.pairs.get(pairId)
  if (!pair) return null
  const plint = pair.plint ? await db.plints.get(pair.plint) : undefined
  const box = plint?.box ? await db.boxes.get(plint.box) : undefined
  const rack = box?.rack ? await db.racks.get(box.rack) : undefined
  const cabinet = rack?.cabinet ? await db.cabinets.get(rack.cabinet) : undefined
  const object = cabinet?.object ? await db.objects.get(cabinet.object) : undefined
  return { pair, plint, box, rack, cabinet, object }
}

/** Короткая метка стороны подключения: «Объект / Шкаф / Плинт 1 / Пара 4». */
export function ctxLabel(ctx: PairContext | null): string {
  if (!ctx) return '(запись не найдена)'
  const parts = [
    ctx.object?.name,
    ctx.cabinet?.name,
    ctx.rack?.name,
    ctx.box ? `Бокс ${ctx.box.number}` : null,
    ctx.plint ? `Плинт ${ctx.plint.number}` : null,
    ctx.pair ? `Пара ${ctx.pair.pair_number}` : null,
  ].filter(Boolean)
  return parts.join(' / ')
}
