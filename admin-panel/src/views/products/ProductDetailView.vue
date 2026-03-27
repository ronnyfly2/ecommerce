<script setup lang="ts">
import { computed, ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { productsService } from '@/services/products.service'
import { reviewsService } from '@/services/reviews.service'
import { extractErrorMessage } from '@/utils/error'
import type { Product, ProductImage, ProductReview, ReviewStats } from '@/types/api'
import { useToast } from '@/composables/useToast'
import { preloadRichEditor } from '@/utils/preload-rich-editor'
import UiCard from '@/components/ui/UiCard.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiFileInput from '@/components/ui/UiFileInput.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiTable from '@/components/ui/UiTable.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'
import { formatMoney } from '@/utils/currency'
import { getSystemCurrencyCode } from '@/utils/system-currency'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()

const product = ref<Product | null>(null)

// Reviews
const reviews = ref<ProductReview[]>([])
const reviewStats = ref<ReviewStats | null>(null)
const reviewsLoading = ref(false)
const reviewsMeta = ref({ page: 1, limit: 10, total: 0, totalPages: 0 })
const reviewsPage = ref(1)
const reviewActionLoading = ref<string | null>(null)
const canApproveReviews = computed(() => auth.isAdmin)
const canReviewProduct = computed(() => auth.isAuthenticated)
const myReview = ref<ProductReview | null>(null)
const reviewForm = reactive({
  rating: 5,
  comment: '',
  loading: false,
  editing: false,
})

function resetReviewForm() {
  reviewForm.rating = 5
  reviewForm.comment = ''
  reviewForm.editing = false
}

function startEditMyReview() {
  if (!myReview.value) return
  reviewForm.rating = myReview.value.rating
  reviewForm.comment = myReview.value.comment ?? ''
  reviewForm.editing = true
}

async function submitMyReview() {
  if (!product.value || !canReviewProduct.value) return

  reviewForm.loading = true
  try {
    if (myReview.value) {
      await reviewsService.update(product.value.id, myReview.value.id, {
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim() || undefined,
      })
      toast.success('Reseña actualizada')
    } else {
      await reviewsService.create(product.value.id, {
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim() || undefined,
      })
      toast.success('Reseña enviada. Quedó pendiente de aprobación.')
    }

    resetReviewForm()
    await loadReviews()
  } catch (e) {
    toast.error('Error', extractErrorMessage(e, 'No se pudo guardar tu reseña'))
  } finally {
    reviewForm.loading = false
  }
}

async function loadReviews() {
  if (!product.value) return
  reviewsLoading.value = true
  try {
    const reviewsRequest = canApproveReviews.value
      ? reviewsService.listAllByProduct(product.value.id, { page: reviewsPage.value, limit: 10 })
      : reviewsService.listByProduct(product.value.id, { page: reviewsPage.value, limit: 10 })

    const myReviewRequest = canReviewProduct.value
      ? reviewsService.getMine(product.value.id)
      : Promise.resolve(null)

    const [data, stats, mine] = await Promise.all([
      reviewsRequest,
      reviewsService.stats(product.value.id),
      myReviewRequest,
    ])

    reviews.value = data.items
    reviewsMeta.value = data.meta
    reviewStats.value = stats
    myReview.value = mine

    if (!reviewForm.editing && myReview.value) {
      reviewForm.rating = myReview.value.rating
      reviewForm.comment = myReview.value.comment ?? ''
    }
  } catch {
    toast.error('Error', 'No se pudieron cargar las reviews')
  } finally {
    reviewsLoading.value = false
  }
}

async function toggleApprove(review: ProductReview) {
  if (!product.value) return
  reviewActionLoading.value = review.id
  try {
    await reviewsService.update(product.value.id, review.id, { isApproved: !review.isApproved })
    toast.success(review.isApproved ? 'Review desaprobada' : 'Review aprobada')
    await loadReviews()
  } catch (e) {
    toast.error('Error', extractErrorMessage(e, 'No se pudo actualizar la review'))
  } finally {
    reviewActionLoading.value = null
  }
}

async function deleteReview(review: ProductReview) {
  if (!product.value) return
  if (!window.confirm('¿Eliminar esta review? Esta acción no se puede deshacer.')) return
  reviewActionLoading.value = review.id
  try {
    await reviewsService.remove(product.value.id, review.id)
    toast.success('Review eliminada')
    await loadReviews()
  } catch (e) {
    toast.error('Error', extractErrorMessage(e, 'No se pudo eliminar la review'))
  } finally {
    reviewActionLoading.value = null
  }
}
const recommendations = ref<{ relatedProducts: Product[]; suggestedProducts: Product[] } | null>(null)
const loading = ref(true)

const imageUpload = reactive({
  file: null as File | null,
  altText: '',
  isMain: false,
  loading: false,
})
const imageActionLoading = ref<string | null>(null)
const canManageProducts = computed(() => auth.can('products.manage'))

const sortedImages = computed(() => {
  const items = product.value?.images ?? []
  return [...items].sort((a, b) => a.displayOrder - b.displayOrder)
})

async function load() {
  loading.value = true
  try {
    const [p, rec] = await Promise.all([
      productsService.get(route.params.id as string),
      productsService.getRecommendations(route.params.id as string),
    ])
    product.value = p
    recommendations.value = {
      relatedProducts: rec.relatedProducts ?? [],
      suggestedProducts: rec.suggestedProducts ?? [],
    }
  } catch {
    toast.error('Error', 'No se pudo cargar el producto')
    router.push({ name: 'products' })
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await load()
  await loadReviews()
})

function onImageFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  imageUpload.file = target.files?.[0] ?? null
}

async function uploadAndAttachImage() {
  if (!product.value) return
  if (!imageUpload.file) {
    toast.warning('Falta archivo', 'Selecciona una imagen para subir')
    return
  }

  imageUpload.loading = true
  try {
    const url = await productsService.uploadImageAsset(imageUpload.file)
    const nextOrder = Math.max(0, ...((product.value.images ?? []).map((img) => img.displayOrder))) + 1

    await productsService.createImage(product.value.id, {
      url,
      altText: imageUpload.altText || undefined,
      isMain: imageUpload.isMain,
      displayOrder: nextOrder,
    })

    toast.success('Imagen agregada')
    imageUpload.file = null
    imageUpload.altText = ''
    imageUpload.isMain = false
    await load()
  } catch (e) {
    toast.error('Error', extractErrorMessage(e, 'No se pudo subir la imagen'))
  } finally {
    imageUpload.loading = false
  }
}

async function setAsMain(image: ProductImage) {
  if (!product.value || image.isMain) return

  imageActionLoading.value = image.id
  try {
    await productsService.updateImage(product.value.id, image.id, { isMain: true })
    toast.success('Imagen principal actualizada')
    await load()
  } catch {
    toast.error('Error', 'No se pudo actualizar la imagen principal')
  } finally {
    imageActionLoading.value = null
  }
}

async function removeImage(image: ProductImage) {
  if (!product.value) return
  if (!window.confirm('¿Eliminar esta imagen del producto?')) return

  imageActionLoading.value = image.id
  try {
    await productsService.removeImage(product.value.id, image.id)
    toast.success('Imagen eliminada')
    await load()
  } catch {
    toast.error('Error', 'No se pudo eliminar la imagen')
  } finally {
    imageActionLoading.value = null
  }
}

function fmt(n: string | number, currencyCode = product.value?.currencyCode || getSystemCurrencyCode()) {
  return formatMoney(n, currencyCode)
}


function recommendationImage(product: Product) {
  const main = product.images?.find((img) => img.isMain)
  return main?.url || product.images?.[0]?.url || ''
}

function recommendationPrice(product: Product) {
  if (product.hasOffer && product.offerPrice) {
    return fmt(product.offerPrice, product.currencyCode)
  }

  return fmt(product.basePrice, product.currencyCode)
}

const relatedForDisplay = computed(() => {
  if (recommendations.value) {
    return recommendations.value.relatedProducts
  }
  return product.value?.relatedProducts ?? []
})

const suggestedForDisplay = computed(() => {
  if (recommendations.value) {
    return recommendations.value.suggestedProducts
  }
  return product.value?.suggestedProducts ?? []
})
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center py-20">
    <div class="flex flex-col items-center gap-3 text-muted">
      <svg class="w-8 h-8 animate-spin text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      Cargando...
    </div>
  </div>

  <div v-else-if="product" class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <button class="text-muted hover:text-surface-900 transition-colors text-sm" @click="router.push({ name: 'products' })">
            ← Productos
          </button>
        </div>
        <h2 class="text-heading-2">{{ product.name }}</h2>
        <p class="text-muted">{{ product.slug }}</p>
        <p class="text-caption font-mono mt-1">SKU: {{ product.sku }}</p>
      </div>
      <div class="flex gap-2 shrink-0">
        <UiButton
          v-if="canManageProducts"
          variant="secondary"
          @mouseenter="preloadRichEditor()"
          @focus="preloadRichEditor()"
          @click="router.push({ name: 'products-edit', params: { id: product.id } })"
        >
          Editar
        </UiButton>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-4">
        <UiCard title="Información general">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p class="text-caption mb-1">Categoría</p>
              <p class="font-medium">{{ product.category?.name ?? '—' }}</p>
            </div>
            <div>
              <p class="text-caption mb-1">SKU</p>
              <p class="font-medium font-mono">{{ product.sku }}</p>
            </div>
            <div>
              <p class="text-caption mb-1">Precio base</p>
              <p class="font-medium">{{ fmt(product.basePrice, product.currencyCode) }}</p>
            </div>
            <div>
              <p class="text-caption mb-1">Estado</p>
              <UiBadge :color="product.isActive ? 'success' : 'neutral'" dot>
                {{ product.isActive ? 'Activo' : 'Inactivo' }}
              </UiBadge>
            </div>
            <div>
              <p class="text-caption mb-1">Destacado</p>
              <UiBadge :color="product.isFeatured ? 'primary' : 'neutral'" dot>
                {{ product.isFeatured ? 'Sí' : 'No' }}
              </UiBadge>
            </div>
          </div>
          <div v-if="product.description" class="mt-4">
            <p class="text-caption mb-1">Descripción</p>
            <div class="text-body prose prose-sm max-w-none" v-html="product.description" />
          </div>
          <div v-if="product.graphicDescription" class="mt-4">
            <p class="text-caption mb-1">Graphic Description</p>
            <p class="text-body whitespace-pre-line">{{ product.graphicDescription }}</p>
          </div>
          <div v-if="product.usageMode" class="mt-4">
            <p class="text-caption mb-1">Usage Mode</p>
            <p class="text-body whitespace-pre-line">{{ product.usageMode }}</p>
          </div>
        </UiCard>

        <UiCard>
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-heading-3">Variantes independientes ({{ product.variantProducts?.length ?? 0 }})</h3>
          </div>

          <div class="-mx-6">
            <UiTable compact :empty="!product.variantProducts?.length" empty-message="Sin variantes independientes">
              <template #head>
                <tr>
                  <th class="table-th">Producto</th>
                  <th class="table-th text-right">Precio</th>
                  <th class="table-th text-center">Estado</th>
                  <th class="table-th table-actions-th" />
                </tr>
              </template>

              <tr v-for="variantProduct in product.variantProducts" :key="variantProduct.id" class="table-tr-hover">
                <td class="table-td">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg overflow-hidden bg-surface-100 shrink-0">
                      <img
                        v-if="recommendationImage(variantProduct)"
                        :src="recommendationImage(variantProduct)"
                        :alt="variantProduct.name"
                        class="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p class="font-medium text-surface-900">{{ variantProduct.name }}</p>
                      <p class="text-caption font-mono">{{ variantProduct.sku }}</p>
                    </div>
                  </div>
                </td>
                <td class="table-td text-right">{{ recommendationPrice(variantProduct) }}</td>
                <td class="table-td text-center">
                  <UiBadge :color="variantProduct.isActive ? 'success' : 'neutral'" dot>
                    {{ variantProduct.isActive ? 'Activa' : 'Inactiva' }}
                  </UiBadge>
                </td>
                <td class="table-td table-actions-td">
                  <div class="flex items-center justify-end gap-1">
                    <UiButton
                      size="sm"
                      variant="secondary"
                      @click="router.push({ name: 'products-detail', params: { id: variantProduct.id } })"
                    >
                      Ver
                    </UiButton>
                    <UiButton
                      v-if="canManageProducts"
                      size="sm"
                      variant="ghost"
                      @click="router.push({ name: 'products-edit', params: { id: variantProduct.id } })"
                    >
                      Editar
                    </UiButton>
                  </div>
                </td>
              </tr>
            </UiTable>
          </div>
        </UiCard>

        <UiCard title="Recomendaciones del producto">
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-medium text-surface-800">Relacionados</h3>
                <UiBadge color="neutral">{{ relatedForDisplay.length }}</UiBadge>
              </div>

              <UiEmptyState
                v-if="!relatedForDisplay.length"
                title="Sin productos relacionados"
                description="Cuando configures recomendaciones aparecerán aquí."
                compact
              />

              <button
                v-for="related in relatedForDisplay"
                :key="related.id"
                type="button"
                class="w-full rounded-xl border border-surface-200 bg-surface-0 p-3 text-left hover:border-primary-300"
                @click="router.push({ name: 'products-detail', params: { id: related.id } })"
              >
                <div class="flex items-center gap-3">
                  <div class="w-11 h-11 rounded-lg overflow-hidden bg-surface-100 shrink-0">
                    <img v-if="recommendationImage(related)" :src="recommendationImage(related)" :alt="related.name" class="w-full h-full object-cover" />
                  </div>
                  <div class="min-w-0">
                    <p class="font-medium text-surface-900 truncate">{{ related.name }}</p>
                    <p class="text-xs font-mono text-surface-500 truncate">{{ related.sku }}</p>
                    <p class="text-xs text-surface-700">{{ recommendationPrice(related) }}</p>
                  </div>
                </div>
              </button>
            </div>

            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-medium text-surface-800">Sugeridos</h3>
                <UiBadge color="primary">{{ suggestedForDisplay.length }}</UiBadge>
              </div>

              <UiEmptyState
                v-if="!suggestedForDisplay.length"
                title="Sin productos sugeridos"
                description="Agrega sugeridos para impulsar venta cruzada."
                compact
              />

              <button
                v-for="suggested in suggestedForDisplay"
                :key="suggested.id"
                type="button"
                class="w-full rounded-xl border border-surface-200 bg-surface-0 p-3 text-left hover:border-primary-300"
                @click="router.push({ name: 'products-detail', params: { id: suggested.id } })"
              >
                <div class="flex items-center gap-3">
                  <div class="w-11 h-11 rounded-lg overflow-hidden bg-surface-100 shrink-0">
                    <img v-if="recommendationImage(suggested)" :src="recommendationImage(suggested)" :alt="suggested.name" class="w-full h-full object-cover" />
                  </div>
                  <div class="min-w-0">
                    <p class="font-medium text-surface-900 truncate">{{ suggested.name }}</p>
                    <p class="text-xs font-mono text-surface-500 truncate">{{ suggested.sku }}</p>
                    <p class="text-xs text-surface-700">{{ recommendationPrice(suggested) }}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </UiCard>

        <UiCard>
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-heading-3">Reviews de clientes</h3>
            <div v-if="reviewStats" class="flex items-center gap-3">
              <span class="text-sm text-muted">
                {{ reviewStats.total }} reseña{{ reviewStats.total !== 1 ? 's' : '' }} aprobada{{ reviewStats.total !== 1 ? 's' : '' }}
              </span>
              <div v-if="reviewStats.average !== null" class="flex items-center gap-1">
                <span class="text-yellow-500">★</span>
                <span class="font-medium text-sm">{{ reviewStats.average }}</span>
              </div>
            </div>
          </div>

          <div v-if="canReviewProduct" class="mb-4 rounded-xl border border-surface-200 p-4 bg-surface-50 space-y-3">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-surface-900">
                {{ myReview ? 'Tu reseña' : 'Escribe tu reseña' }}
              </p>
              <UiBadge v-if="myReview" :color="myReview.isApproved ? 'success' : 'warning'" dot>
                {{ myReview.isApproved ? 'Aprobada' : 'Pendiente' }}
              </UiBadge>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-sm text-muted">Calificación:</span>
              <div class="flex gap-1">
                <button
                  v-for="star in [1, 2, 3, 4, 5]"
                  :key="`star-${star}`"
                  type="button"
                  class="text-lg leading-none"
                  :class="star <= reviewForm.rating ? 'text-yellow-500' : 'text-surface-300'"
                  @click="reviewForm.rating = star"
                >
                  ★
                </button>
              </div>
            </div>

            <UiTextarea
              v-model="reviewForm.comment"
              size="lg"
              :rows="3"
              label="Comentario"
              placeholder="Comparte tu experiencia con este producto"
            />

            <div class="flex items-center gap-2">
              <UiButton :loading="reviewForm.loading" @click="submitMyReview">
                {{ myReview ? 'Actualizar reseña' : 'Enviar reseña' }}
              </UiButton>
              <UiButton
                v-if="myReview"
                variant="secondary"
                :disabled="reviewForm.loading"
                @click="startEditMyReview"
              >
                Restaurar valores
              </UiButton>
              <UiButton
                v-if="myReview"
                variant="ghost"
                :disabled="reviewForm.loading"
                @click="resetReviewForm"
              >
                Limpiar
              </UiButton>
            </div>
          </div>

          <div v-if="reviewStats && reviewStats.total > 0" class="mb-4 grid grid-cols-5 gap-2">
            <div
              v-for="star in [5, 4, 3, 2, 1]"
              :key="star"
              class="flex flex-col items-center gap-1 rounded-lg bg-surface-50 p-2"
            >
              <span class="text-yellow-500 text-sm leading-none">{{ '★'.repeat(star) }}</span>
              <span class="font-semibold text-sm">{{ reviewStats.distribution[String(star)] ?? 0 }}</span>
            </div>
          </div>

          <div v-if="reviewsLoading" class="flex justify-center py-8">
            <svg class="w-6 h-6 animate-spin text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>

          <UiEmptyState v-else-if="!reviews.length" title="Sin reviews" description="Este producto aún no tiene reseñas de clientes." compact />

          <div v-else class="space-y-3 -mx-6">
            <div
              v-for="review in reviews"
              :key="review.id"
              class="px-6 py-3 border-b border-surface-100 last:border-0"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-yellow-500 text-sm leading-none">{{ '★'.repeat(review.rating) }}{{ '☆'.repeat(5 - review.rating) }}</span>
                    <UiBadge :color="review.isApproved ? 'success' : 'warning'" dot>
                      {{ review.isApproved ? 'Aprobada' : 'Pendiente' }}
                    </UiBadge>
                  </div>
                  <p v-if="review.comment" class="text-sm text-surface-800 mb-1">{{ review.comment }}</p>
                  <p class="text-caption">
                    {{ review.user.email }}
                    <span v-if="review.user.firstName || review.user.lastName">
                      - {{ [review.user.firstName, review.user.lastName].filter(Boolean).join(' ') }}
                    </span>
                  </p>
                  <p class="text-caption mt-0.5">{{ new Date(review.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) }}</p>
                </div>

                <div v-if="canApproveReviews" class="flex items-center gap-1 shrink-0">
                  <UiButton
                    size="sm"
                    :variant="review.isApproved ? 'secondary' : 'primary'"
                    :loading="reviewActionLoading === review.id"
                    @click="toggleApprove(review)"
                  >
                    {{ review.isApproved ? 'Desaprobar' : 'Aprobar' }}
                  </UiButton>
                  <UiButton
                    size="sm"
                    variant="danger"
                    :loading="reviewActionLoading === review.id"
                    @click="deleteReview(review)"
                  >
                    Eliminar
                  </UiButton>
                </div>
              </div>
            </div>
          </div>

          <div v-if="reviewsMeta.totalPages > 1" class="flex items-center justify-between mt-4 pt-4 border-t border-surface-100">
            <span class="text-caption">
              Página {{ reviewsMeta.page }} de {{ reviewsMeta.totalPages }}
              ({{ reviewsMeta.total }} en total)
            </span>
            <div class="flex gap-2">
              <UiButton
                size="sm"
                variant="secondary"
                :disabled="reviewsMeta.page <= 1"
                @click="reviewsPage--; loadReviews()"
              >
                Anterior
              </UiButton>
              <UiButton
                size="sm"
                variant="secondary"
                :disabled="reviewsMeta.page >= reviewsMeta.totalPages"
                @click="reviewsPage++; loadReviews()"
              >
                Siguiente
              </UiButton>
            </div>
          </div>
        </UiCard>
      </div>

      <div>
        <UiCard :title="canManageProducts ? 'Gestión de imágenes' : 'Imágenes'">
          <div class="space-y-4">
            <div v-if="canManageProducts" class="space-y-2">
              <UiFileInput accept="image/*" size="lg" label="Imagen" @change="onImageFileSelected" />
              <UiInput v-model="imageUpload.altText" label="Texto alternativo" size="lg" placeholder="Texto alternativo (opcional)" />
              <FormToggleField v-model="imageUpload.isMain" label="Marcar como principal" size="lg" />
              <UiButton class="w-full" :loading="imageUpload.loading" @click="uploadAndAttachImage">
                Subir y asociar imagen
              </UiButton>
            </div>

            <div class="divider" />

            <UiEmptyState v-if="!sortedImages.length" title="Sin imágenes" compact />

            <div v-else class="grid grid-cols-2 gap-2">
              <div
                v-for="img in sortedImages"
                :key="img.id"
                class="aspect-square rounded-lg overflow-hidden bg-surface-100 relative group"
              >
                <img :src="img.url" :alt="img.altText ?? product.name" class="w-full h-full object-cover" />

                <span
                  v-if="img.isMain"
                  class="absolute top-1 left-1 badge-base bg-primary-600 text-white text-xs"
                >
                  Principal
                </span>

                <div class="absolute inset-x-1 bottom-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <UiButton
                    v-if="canManageProducts"
                    size="sm"
                    variant="secondary"
                    class="flex-1"
                    :disabled="img.isMain || imageActionLoading === img.id"
                    @click="setAsMain(img)"
                  >
                    Principal
                  </UiButton>
                  <UiButton
                    v-if="canManageProducts"
                    size="sm"
                    variant="danger"
                    class="flex-1"
                    :loading="imageActionLoading === img.id"
                    @click="removeImage(img)"
                  >
                    Borrar
                  </UiButton>
                </div>
              </div>
            </div>
          </div>
        </UiCard>
      </div>
    </div>
  </div>
</template>
