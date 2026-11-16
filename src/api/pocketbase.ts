import PocketBase from 'pocketbase'

export const pb = new PocketBase(import.meta.env.VITE_PB_URL || 'https://debian-server')
pb.autoCancellation(false)

pb.authStore.loadFromCookie(document.cookie)
pb.authStore.onChange(() => {
  document.cookie = pb.authStore.exportToCookie({ httpOnly: false })
})