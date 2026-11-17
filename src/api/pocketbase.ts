import PocketBase from 'pocketbase'

const configuredUrl = (import.meta.env.VITE_PB_URL || '').trim()

/** true, если VITE_PB_URL не задан — сетевые функции будут недоступны. */
export const pbUrlMissing = !configuredUrl

export const pb = new PocketBase(configuredUrl || 'http://localhost:8090')
pb.autoCancellation(false)

pb.authStore.loadFromCookie(document.cookie)
pb.authStore.onChange(() => {
  document.cookie = pb.authStore.exportToCookie({ httpOnly: false })
})
