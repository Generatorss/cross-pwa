import { ref } from 'vue'
import { pb, pbUrlMissing } from '@/api/pocketbase'
import { db } from '@/db'
import { syncAll } from '@/sync/engine'

/**
 * Автосинхронизация: запуск при появлении сети, при возврате на вкладку,
 * по таймеру (если есть неотправленные изменения) и при попытке закрытия
 * страницы (best-effort: браузер не гарантирует завершение асинхронных запросов).
 */

const AUTO_SYNC_INTERVAL_MS = 60_000
const PENDING_POLL_MS = 10_000

export const online = ref(navigator.onLine)
export const syncing = ref(false)
export const lastSyncAt = ref<string | null>(null)
export const lastError = ref('')
export const pendingCount = ref(0)

let started = false

export async function refreshPending() {
  pendingCount.value = await db.outbox.where('status').equals('pending').count()
}

/** Полный цикл push+pull (ручная кнопка, online-событие). */
export async function runSync(): Promise<{ pushed: number; pulled: number; failed: number } | null> {
  if (syncing.value || pbUrlMissing || !navigator.onLine || !pb.authStore.isValid) return null
  syncing.value = true
  try {
    const result = await syncAll()
    lastSyncAt.value = new Date().toISOString()
    lastError.value = ''
    return result
  } catch (e: any) {
    lastError.value = e?.message || 'Ошибка синхронизации'
    console.warn('[sync] ошибка:', e)
    return null
  } finally {
    syncing.value = false
    await refreshPending()
  }
}

/** Тихий авто-синк: только при наличии pending-изменений. */
async function autoSync(reason: string) {
  if (!navigator.onLine || !pb.authStore.isValid || syncing.value) return
  const pending = await db.outbox.where('status').equals('pending').count()
  if (pending === 0) return
  console.info(`[auto-sync] запуск (${reason}), pending: ${pending}`)
  await runSync()
}

export function startAutoSync() {
  if (started) return
  started = true

  window.addEventListener('online', () => {
    online.value = true
    // при восстановлении сети синхронизируем всегда — подтягиваем изменения с сервера
    runSync()
  })
  window.addEventListener('offline', () => {
    online.value = false
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') autoSync('visible')
  })

  window.addEventListener('pagehide', () => {
    autoSync('pagehide')
  })

  setInterval(() => autoSync('interval'), AUTO_SYNC_INTERVAL_MS)
  setInterval(refreshPending, PENDING_POLL_MS)

  pb.authStore.onChange(() => {
    if (pb.authStore.isValid) runSync()
  })

  refreshPending()
}
