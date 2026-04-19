import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { useToast } from '@/composables/useToast'

/**
 * Composable para cargar una lista desde un servicio asíncrono.
 * Convención: null = cargando, [] = cargado vacío/error, [...] = datos.
 *
 * @param fetcher       Función async que retorna el array de items
 * @param errorMessage  Mensaje a mostrar en toast si falla la carga
 */
export function useResourceList<T>(
  fetcher: () => Promise<T[]>,
  errorMessage: string,
): { items: Ref<T[] | null>; loading: ComputedRef<boolean>; load: () => Promise<void> } {
  const toast = useToast()
  const items = ref<T[] | null>(null) as Ref<T[] | null>

  const loading = computed(() => items.value === null)

  async function load() {
    items.value = null
    try {
      items.value = await fetcher()
    } catch {
      items.value = []
      toast.error('Error', errorMessage)
    }
  }

  return { items, loading, load }
}
