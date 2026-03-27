import { nextTick, onUnmounted, watch, type Ref } from 'vue'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function useDialogA11y(show: Ref<boolean>, panelRef: Ref<HTMLElement | null>, onClose: () => void) {
  let previousActiveElement: HTMLElement | null = null

  function getFocusableElements() {
    if (!panelRef.value) return []

    return Array.from(panelRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
      return !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true'
    })
  }

  function focusInitialElement() {
    const [firstFocusable] = getFocusableElements()
    ;(firstFocusable ?? panelRef.value)?.focus()
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!show.value || !panelRef.value) return

    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') return

    const focusableElements = getFocusableElements()

    if (focusableElements.length === 0) {
      event.preventDefault()
      panelRef.value.focus()
      return
    }

    const firstFocusable = focusableElements[0]
    const lastFocusable = focusableElements[focusableElements.length - 1]
    const activeElement = document.activeElement as HTMLElement | null

    if (event.shiftKey && (activeElement === firstFocusable || activeElement === panelRef.value)) {
      event.preventDefault()
      lastFocusable.focus()
      return
    }

    if (!event.shiftKey && activeElement === lastFocusable) {
      event.preventDefault()
      firstFocusable.focus()
    }
  }

  watch(
    show,
    async (isOpen) => {
      if (isOpen) {
        previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
        document.addEventListener('keydown', handleKeydown)
        await nextTick()
        focusInitialElement()
        return
      }

      document.removeEventListener('keydown', handleKeydown)
      previousActiveElement?.focus()
      previousActiveElement = null
    },
    { immediate: true },
  )

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
  })
}