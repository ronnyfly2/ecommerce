import { ref } from 'vue'

/**
 * Composable genérico para listas reordenables via drag-and-drop HTML5.
 *
 * @param getList  Función que retorna el array actual de items
 * @param setList  Función que persiste el nuevo orden
 * @param getId    Función que extrae el id de string de cada item
 */
export function useDraggableList<T>(
  getList: () => T[],
  setList: (items: T[]) => void,
  getId: (item: T) => string,
) {
  const dragId = ref('')

  function onDragStart(id: string) {
    dragId.value = id
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault()
  }

  function onDrop(targetId: string) {
    if (!dragId.value || dragId.value === targetId) {
      dragId.value = ''
      return
    }

    const list = [...getList()]
    const fromIndex = list.findIndex((item) => getId(item) === dragId.value)
    const toIndex = list.findIndex((item) => getId(item) === targetId)

    if (fromIndex < 0 || toIndex < 0) {
      dragId.value = ''
      return
    }

    const [moved] = list.splice(fromIndex, 1)
    list.splice(toIndex, 0, moved)
    setList(list)
    dragId.value = ''
  }

  function onDragEnd() {
    dragId.value = ''
  }

  return { dragId, onDragStart, onDragOver, onDrop, onDragEnd }
}
