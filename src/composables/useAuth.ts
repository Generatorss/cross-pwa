import { computed } from 'vue'
import { pb } from '@/api/pocketbase'

/**
 * Роли пользователей:
 *  - admin: всё, включая любые удаления (пары, плинты, боксы, объекты и т.д.);
 *  - editor: выездной работник — кроссы, оборудование, внешние провода,
 *    создание/правка записей; удаления недоступны;
 *  - viewer: стажёр — только просмотр.
 * Матрица продублирована правилами коллекций PocketBase на сервере.
 */
export function useAuth() {
  const role = computed<string | undefined>(() => (pb.authStore.model as any)?.role)
  const isAdmin = computed(() => role.value === 'admin')
  const isEditor = computed(() => role.value === 'editor')
  const isViewer = computed(() => role.value === 'viewer')
  const canEdit = computed(() => role.value === 'admin' || role.value === 'editor')
  const canDelete = isAdmin
  return { role, isAdmin, isEditor, isViewer, canEdit, canDelete }
}
