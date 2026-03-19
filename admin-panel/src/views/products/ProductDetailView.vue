<script setup lang="ts">
import { computed, ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { productsService } from '@/services/products.service'
import { extractErrorMessage } from '@/utils/error'
import { sizesService, colorsService } from '@/services/catalog.service'
import type { Product, Size, Color, CreateProductVariantDto, ProductImage } from '@/types/api'
import { useToast } from '@/composables/useToast'
import UiCard from '@/components/ui/UiCard.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const product = ref<Product | null>(null)
const sizes = ref<Size[]>([])
const colors = ref<Color[]>([])
const loading = ref(true)

const variantModal = reactive({ show: false, loading: false })
const variantForm = reactive<CreateProductVariantDto>({
  sku: '',
  sizeId: '',
  colorId: '',
  stock: 0,
  additionalPrice: 0,
  isActive: true,
})
const deleteConfirm = reactive({ show: false, variantId: '', loading: false })

const imageUpload = reactive({
  file: null as File | null,
  altText: '',
  isMain: false,
  loading: false,
})
const imageActionLoading = ref<string | null>(null)

const sortedImages = computed(() => {
  const items = product.value?.images ?? []
  return [...items].sort((a, b) => a.displayOrder - b.displayOrder)
})

async function load() {
  loading.value = true
  try {
    const [p, s, c] = await Promise.all([
      productsService.get(route.params.id as string),
      sizesService.list(),
      colorsService.list(),
    ])
    product.value = p
    sizes.value = s
    colors.value = c
  } catch {
    toast.error('Error', 'No se pudo cargar el producto')
    router.push({ name: 'products' })
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function addVariant() {
  if (!product.value) return

  variantModal.loading = true
  try {
    await productsService.createVariant(product.value.id, { ...variantForm })
    toast.success('Variante agregada')
    variantModal.show = false
    variantForm.sku = ''
    variantForm.sizeId = ''
    variantForm.colorId = ''
    variantForm.stock = 0
    variantForm.additionalPrice = 0
    variantForm.isActive = true
    await load()
  } catch (e) {
    toast.error('Error', extractErrorMessage(e, 'Error al crear variante'))
  } finally {
    variantModal.loading = false
  }
}

async function deleteVariant() {
  if (!product.value) return

  deleteConfirm.loading = true
  try {
    await productsService.removeVariant(product.value.id, deleteConfirm.variantId)
    toast.success('Variante eliminada')
    deleteConfirm.show = false
    await load()
  } catch {
    toast.error('Error', 'No se pudo eliminar la variante')
  } finally {
    deleteConfirm.loading = false
  }
}

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

function fmt(n: string | number) {
  return Number(n).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  })
}
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center py-20">
    <div class="flex flex-col items-center gap-3 text-muted">
      <svg class="w-8 h-8 animate-spin text-[--color-primary-600]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
          <button class="text-muted hover:text-[--color-surface-900] transition-colors text-sm" @click="router.push({ name: 'products' })">
            ← Productos
          </button>
        </div>
        <h2 class="text-heading-2">{{ product.name }}</h2>
        <p class="text-muted">{{ product.slug }}</p>
      </div>
      <div class="flex gap-2 shrink-0">
        <UiButton variant="secondary" @click="router.push({ name: 'products-edit', params: { id: product.id } })">
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
              <p class="text-caption mb-1">Precio base</p>
              <p class="font-medium">{{ fmt(product.basePrice) }}</p>
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
            <p class="text-body">{{ product.description }}</p>
          </div>
        </UiCard>

        <UiCard>
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-heading-3">Variantes ({{ product.variants?.length ?? 0 }})</h3>
            <UiButton size="sm" @click="variantModal.show = true">+ Agregar</UiButton>
          </div>

          <div v-if="!product.variants?.length" class="text-muted text-center py-6">
            Sin variantes
          </div>
          <div v-else class="overflow-x-auto -mx-6">
            <table class="table-base">
              <thead>
                <tr>
                  <th class="table-th">SKU</th>
                  <th class="table-th">Talla</th>
                  <th class="table-th">Color</th>
                  <th class="table-th text-right">Stock</th>
                  <th class="table-th text-right">+ Precio</th>
                  <th class="table-th text-center">Estado</th>
                  <th class="table-th" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="v in product.variants" :key="v.id" class="table-tr-hover">
                  <td class="table-td font-mono text-xs">{{ v.sku }}</td>
                  <td class="table-td">{{ v.size?.name }}</td>
                  <td class="table-td">
                    <div class="flex items-center gap-2">
                      <span
                        class="w-4 h-4 rounded-full border border-[--color-surface-200] inline-block"
                        :style="{ backgroundColor: v.color?.hexCode }"
                      />
                      {{ v.color?.name }}
                    </div>
                  </td>
                  <td class="table-td text-right">
                    <span :class="v.stock <= 0 ? 'text-[--color-danger-600]' : 'text-[--color-surface-900]'">
                      {{ v.stock }}
                    </span>
                  </td>
                  <td class="table-td text-right">{{ fmt(v.additionalPrice) }}</td>
                  <td class="table-td text-center">
                    <UiBadge :color="v.isActive ? 'success' : 'neutral'" dot>
                      {{ v.isActive ? 'Activa' : 'Inactiva' }}
                    </UiBadge>
                  </td>
                  <td class="table-td">
                    <UiButton
                      variant="danger"
                      size="sm"
                      @click="deleteConfirm.variantId = v.id; deleteConfirm.show = true"
                    >
                      Eliminar
                    </UiButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UiCard>
      </div>

      <div>
        <UiCard title="Gestión de imágenes">
          <div class="space-y-4">
            <div class="space-y-2">
              <input type="file" accept="image/*" class="input-base" @change="onImageFileSelected" />
              <input v-model="imageUpload.altText" class="input-base" placeholder="Texto alternativo (opcional)" />
              <label class="flex items-center gap-2 text-sm text-[--color-surface-700]">
                <input v-model="imageUpload.isMain" type="checkbox" class="accent-[--color-primary-600]" />
                Marcar como principal
              </label>
              <UiButton class="w-full" :loading="imageUpload.loading" @click="uploadAndAttachImage">
                Subir y asociar imagen
              </UiButton>
            </div>

            <div class="divider" />

            <div v-if="!sortedImages.length" class="text-muted text-center py-6">Sin imágenes</div>

            <div v-else class="grid grid-cols-2 gap-2">
              <div
                v-for="img in sortedImages"
                :key="img.id"
                class="aspect-square rounded-lg overflow-hidden bg-[--color-surface-100] relative group"
              >
                <img :src="img.url" :alt="img.altText ?? product.name" class="w-full h-full object-cover" />

                <span
                  v-if="img.isMain"
                  class="absolute top-1 left-1 badge-base bg-[--color-primary-600] text-white text-xs"
                >
                  Principal
                </span>

                <div class="absolute inset-x-1 bottom-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <UiButton
                    size="sm"
                    variant="secondary"
                    class="flex-1"
                    :disabled="img.isMain || imageActionLoading === img.id"
                    @click="setAsMain(img)"
                  >
                    Principal
                  </UiButton>
                  <UiButton
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

    <UiModal :show="variantModal.show" title="Nueva variante" @close="variantModal.show = false">
      <form @submit.prevent="addVariant" class="space-y-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-[--color-surface-700]">SKU *</label>
          <input v-model="variantForm.sku" required class="input-base" placeholder="SHIRT-BLK-M" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-[--color-surface-700]">Talla *</label>
            <select v-model="variantForm.sizeId" required class="input-base">
              <option value="" disabled>Seleccionar</option>
              <option v-for="s in sizes" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-[--color-surface-700]">Color *</label>
            <select v-model="variantForm.colorId" required class="input-base">
              <option value="" disabled>Seleccionar</option>
              <option v-for="c in colors" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-[--color-surface-700]">Stock *</label>
            <input v-model.number="variantForm.stock" type="number" min="0" required class="input-base" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-[--color-surface-700]">Precio adicional</label>
            <input v-model.number="variantForm.additionalPrice" type="number" min="0" step="0.01" class="input-base" />
          </div>
        </div>
      </form>
      <template #footer>
        <UiButton variant="secondary" @click="variantModal.show = false">Cancelar</UiButton>
        <UiButton :loading="variantModal.loading" @click="addVariant">Guardar variante</UiButton>
      </template>
    </UiModal>

    <UiConfirm
      :show="deleteConfirm.show"
      title="Eliminar variante"
      message="¿Eliminar esta variante? El stock se perderá."
      :loading="deleteConfirm.loading"
      @confirm="deleteVariant"
      @cancel="deleteConfirm.show = false"
    />
  </div>
</template>
