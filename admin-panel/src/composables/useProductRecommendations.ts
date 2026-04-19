import { ref, computed, type ComputedRef } from 'vue'
import { useDraggableList } from '@/composables/useDraggableList'
import type { Product } from '@/types/api'

interface RecommendationForm {
  relatedProductIds: string[]
  suggestedProductIds: string[]
  variantProductIds: string[]
}

/**
 * Composable para la gestión de productos relacionados, sugeridos y variantes.
 * Incluye búsqueda, filtrado, toggle, remoción y drag-and-drop de orden.
 *
 * @param currentProductId  ID del producto que se está editando (excluido de resultados)
 * @param form              Objeto reactivo con los arrays de IDs de relaciones
 */
export function useProductRecommendations(
  currentProductId: ComputedRef<string>,
  form: RecommendationForm,
) {
  const availableRelatedProducts = ref<Product[]>([])
  const relatedProductSearch = ref('')
  const suggestedProductSearch = ref('')
  const variantProductSearch = ref('')

  // ── Drag & drop de relacionados y sugeridos ───────────────────────────────
  const {
    onDragStart: _relatedDragStart,
    onDragOver: onRecommendationDragOver,
    onDrop: _relatedDrop,
    onDragEnd: _relatedDragEnd,
  } = useDraggableList(
    () => form.relatedProductIds,
    (list) => { form.relatedProductIds = list },
    (id) => id,
  )

  const {
    onDragStart: _suggestedDragStart,
    onDrop: _suggestedDrop,
    onDragEnd: _suggestedDragEnd,
  } = useDraggableList(
    () => form.suggestedProductIds,
    (list) => { form.suggestedProductIds = list },
    (id) => id,
  )

  function onRecommendationDragStart(group: 'related' | 'suggested', productId: string) {
    if (group === 'related') _relatedDragStart(productId)
    else _suggestedDragStart(productId)
  }

  function onRecommendationDrop(group: 'related' | 'suggested', targetProductId: string) {
    if (group === 'related') _relatedDrop(targetProductId)
    else _suggestedDrop(targetProductId)
  }

  function onRecommendationDragEnd() {
    _relatedDragEnd()
    _suggestedDragEnd()
  }

  // ── Computed seleccionados ────────────────────────────────────────────────
  const selectedRelatedProducts = computed(() =>
    form.relatedProductIds
      .map((id) => availableRelatedProducts.value.find((item) => item.id === id) ?? null)
      .filter((item): item is Product => item !== null),
  )

  const selectedVariantProducts = computed(() =>
    form.variantProductIds
      .map((id) => availableRelatedProducts.value.find((item) => item.id === id) ?? null)
      .filter((item): item is Product => item !== null),
  )

  const selectedSuggestedProducts = computed(() =>
    form.suggestedProductIds
      .map((id) => availableRelatedProducts.value.find((item) => item.id === id) ?? null)
      .filter((item): item is Product => item !== null),
  )

  // ── Helpers ───────────────────────────────────────────────────────────────

  function recommendationListByGroup(group: 'related' | 'suggested' | 'variant'): string[] {
    if (group === 'related') return form.relatedProductIds
    if (group === 'suggested') return form.suggestedProductIds
    return form.variantProductIds
  }

  function filterRecommendationProducts(searchValue: string, group: 'related' | 'suggested' | 'variant') {
    const search = searchValue.trim().toLowerCase()
    const currentList = recommendationListByGroup(group)

    const excludedIds = new Set([
      currentProductId.value,
      ...form.relatedProductIds,
      ...form.suggestedProductIds,
      ...form.variantProductIds,
    ])
    for (const itemId of currentList) {
      excludedIds.delete(itemId)
    }

    const baseItems = availableRelatedProducts.value.filter((item) => !excludedIds.has(item.id))

    if (!search) return baseItems.slice(0, 12)

    return baseItems
      .filter((item) =>
        [item.name, item.sku, item.slug]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(search)),
      )
      .slice(0, 12)
  }

  const filteredRelatedProducts = computed(() =>
    filterRecommendationProducts(relatedProductSearch.value, 'related'),
  )
  const filteredSuggestedProducts = computed(() =>
    filterRecommendationProducts(suggestedProductSearch.value, 'suggested'),
  )
  const filteredVariantProducts = computed(() =>
    filterRecommendationProducts(variantProductSearch.value, 'variant'),
  )

  function toggleRecommendationProduct(group: 'related' | 'suggested' | 'variant', productId: string) {
    if (productId === currentProductId.value) return

    const activeList = recommendationListByGroup(group)

    if (activeList.includes(productId)) {
      if (group === 'related') form.relatedProductIds = form.relatedProductIds.filter((id) => id !== productId)
      else if (group === 'suggested') form.suggestedProductIds = form.suggestedProductIds.filter((id) => id !== productId)
      else form.variantProductIds = form.variantProductIds.filter((id) => id !== productId)
      return
    }

    // Quitar de todos antes de agregar al grupo correcto
    form.relatedProductIds = form.relatedProductIds.filter((id) => id !== productId)
    form.suggestedProductIds = form.suggestedProductIds.filter((id) => id !== productId)
    form.variantProductIds = form.variantProductIds.filter((id) => id !== productId)

    if (group === 'related') form.relatedProductIds = [...form.relatedProductIds, productId]
    else if (group === 'suggested') form.suggestedProductIds = [...form.suggestedProductIds, productId]
    else form.variantProductIds = [...form.variantProductIds, productId]
  }

  function removeRecommendationProduct(group: 'related' | 'suggested' | 'variant', productId: string) {
    if (group === 'related') { form.relatedProductIds = form.relatedProductIds.filter((id) => id !== productId); return }
    if (group === 'suggested') { form.suggestedProductIds = form.suggestedProductIds.filter((id) => id !== productId); return }
    form.variantProductIds = form.variantProductIds.filter((id) => id !== productId)
  }

  function recommendationImage(product: Product) {
    const main = product.images?.find((img) => img.isMain)
    return main?.url || product.images?.[0]?.url || ''
  }

  return {
    availableRelatedProducts,
    relatedProductSearch,
    suggestedProductSearch,
    variantProductSearch,
    selectedRelatedProducts,
    selectedVariantProducts,
    selectedSuggestedProducts,
    filteredRelatedProducts,
    filteredSuggestedProducts,
    filteredVariantProducts,
    recommendationListByGroup,
    onRecommendationDragStart,
    onRecommendationDragOver,
    onRecommendationDrop,
    onRecommendationDragEnd,
    toggleRecommendationProduct,
    removeRecommendationProduct,
    recommendationImage,
  }
}
