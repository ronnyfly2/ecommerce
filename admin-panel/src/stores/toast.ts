import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<ToastMessage[]>([])

  function add(toast: Omit<ToastMessage, 'id'>) {
    const id = crypto.randomUUID()
    const duration = toast.duration ?? 4000
    toasts.value.push({ ...toast, id, duration })

    if (duration > 0) {
      setTimeout(() => remove(id), duration)
    }
    return id
  }

  function remove(id: string) {
    const idx = toasts.value.findIndex((t) => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  function success(title: string, message?: string) {
    return add({ type: 'success', title, message })
  }

  function error(title: string, message?: string) {
    return add({ type: 'error', title, message, duration: 6000 })
  }

  function warning(title: string, message?: string) {
    return add({ type: 'warning', title, message })
  }

  function info(title: string, message?: string) {
    return add({ type: 'info', title, message })
  }

  return { toasts, add, remove, success, error, warning, info }
})
