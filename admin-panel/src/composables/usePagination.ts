import { ref, computed } from 'vue'

export function usePagination(initialLimit = 15) {
  const page = ref(1)
  const limit = ref(initialLimit)
  const total = ref(0)

  const totalPages = computed(() => Math.ceil(total.value / limit.value))
  const hasPrev = computed(() => page.value > 1)
  const hasNext = computed(() => page.value < totalPages.value)

  function goTo(p: number) {
    if (p >= 1 && p <= totalPages.value) page.value = p
  }

  function next() {
    if (hasNext.value) page.value++
  }

  function prev() {
    if (hasPrev.value) page.value--
  }

  function reset() {
    page.value = 1
  }

  return { page, limit, total, totalPages, hasPrev, hasNext, goTo, next, prev, reset }
}
