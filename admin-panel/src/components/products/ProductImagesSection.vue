<script setup lang="ts">
import UiCard from '@/components/ui/UiCard.vue'
import UiFileInput from '@/components/ui/UiFileInput.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'
import type { Product, ProductImage } from '@/types/api'

type PendingImage = {
  id: string
  file: File
  displayOrder: number
  altText: string
}

type ImageUploadModel = {
  files: PendingImage[]
  markFirstAsMain: boolean
}

type VariantImageModalModel = {
  show: boolean
  productId: string
  file: File | null
  altText: string
  isMain: boolean
  loading: boolean
  actionLoading: string | null
}

defineProps<{
  isEdit: boolean
  product: Product | null
  formName: string
  imageUpload: ImageUploadModel
  uploadingImage: boolean
  sortedImages: ProductImage[]
  savingImageOrder: boolean
  hasImageOrderChanges: boolean
  existingImageOrder: string[]
  imageActionLoading: string | null
  imageById: (imageId: string) => ProductImage | null
  onImageFileSelected: (event: Event) => void
  removePendingImage: (pendingId: string) => void
  onPendingImageDragStart: (imageId: string) => void
  onPendingImageDragOver: (event: DragEvent) => void
  onPendingImageDrop: (targetImageId: string) => void
  onPendingImageDragEnd: () => void
  uploadAndAttachImage: () => Promise<void>
  saveImageOrder: () => Promise<void>
  onExistingImageDragStart: (imageId: string) => void
  onExistingImageDragOver: (event: DragEvent) => void
  onExistingImageDrop: (targetImageId: string) => void
  onExistingImageDragEnd: () => void
  setAsMain: (image: ProductImage) => Promise<void>
  removeImage: (image: ProductImage) => Promise<void>
  variantImageModal: VariantImageModalModel
  selectedVariantForImage: Product | null
  variantSortedImages: ProductImage[]
  closeVariantImageManager: () => void
  onVariantImageFileSelected: (event: Event) => void
  uploadAndAttachVariantImage: () => Promise<void>
  attachExistingProductImageToVariant: (image: ProductImage) => Promise<void>
  setVariantImageAsMain: (image: ProductImage) => Promise<void>
  removeVariantImage: (image: ProductImage) => Promise<void>
}>()
</script>

<template>
  <UiCard title="Imagenes del producto">
    <div v-if="!isEdit || !product" class="text-sm text-surface-600 p-4">
      Este bloque se habilita cuando el producto ya fue creado.
    </div>

    <div v-else class="space-y-4 p-4">
      <UiFileInput multiple accept="image/*" size="lg" label="Imágenes" @change="onImageFileSelected" />
      <FormToggleField v-model="imageUpload.markFirstAsMain" label="Marcar la primera como principal" size="lg" />

      <div v-if="imageUpload.files.length" class="space-y-2 rounded-xl border border-surface-200 bg-surface-50 p-3">
        <p class="text-xs font-medium text-surface-600">Imágenes a subir (arrastra para ordenar)</p>
        <div
          v-for="item in imageUpload.files"
          :key="item.id"
          class="rounded-lg border border-surface-200 bg-surface-0 p-2"
          draggable="true"
          @dragstart="onPendingImageDragStart(item.id)"
          @dragover="onPendingImageDragOver"
          @drop="onPendingImageDrop(item.id)"
          @dragend="onPendingImageDragEnd"
        >
          <div class="grid grid-cols-[24px_1fr_auto] items-start gap-2">
            <span class="mt-2 text-surface-400">::</span>
            <div class="space-y-2 min-w-0">
              <p class="truncate text-xs text-surface-700">
                {{ item.displayOrder }}. {{ item.file.name }}
              </p>
              <UiInput v-model="item.altText" size="sm" placeholder="Texto alternativo de esta imagen (opcional)" />
            </div>
            <UiButton size="sm" variant="danger" @click="removePendingImage(item.id)">Quitar</UiButton>
          </div>
        </div>
      </div>

      <UiButton :loading="uploadingImage" :disabled="!imageUpload.files.length" @click="uploadAndAttachImage">
        Subir y asociar {{ imageUpload.files.length }} imagen(es)
      </UiButton>

      <div class="divider" />

      <UiEmptyState v-if="!sortedImages.length" title="Sin imágenes cargadas" compact />

      <template v-else>
        <div class="space-y-2 rounded-xl border border-surface-200 bg-surface-50 p-3">
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-medium text-surface-600">Orden de imágenes actuales (arrastra para ordenar)</p>
            <UiButton size="sm" :loading="savingImageOrder" :disabled="!hasImageOrderChanges" @click="saveImageOrder">
              Guardar orden
            </UiButton>
          </div>
          <div
            v-for="imageId in existingImageOrder"
            :key="`order-${imageId}`"
            class="grid grid-cols-[20px_56px_1fr] items-center gap-2 rounded-lg border border-surface-200 bg-surface-0 p-2"
            draggable="true"
            @dragstart="onExistingImageDragStart(imageId)"
            @dragover="onExistingImageDragOver"
            @drop="onExistingImageDrop(imageId)"
            @dragend="onExistingImageDragEnd"
          >
            <span class="text-surface-400">::</span>
            <img
              :src="imageById(imageId)?.url"
              :alt="imageById(imageId)?.altText ?? formName"
              class="h-12 w-14 rounded object-cover"
            />
            <p class="truncate text-xs text-surface-700">
              {{ imageById(imageId)?.altText || imageById(imageId)?.url }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="img in sortedImages"
            :key="img.id"
            class="aspect-square rounded-lg overflow-hidden bg-surface-100 relative group"
          >
            <img :src="img.url" :alt="img.altText ?? formName" class="w-full h-full object-cover" />

            <span v-if="img.isMain" class="absolute top-1 left-1 badge-base bg-primary-600 text-white text-xs">
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
      </template>
    </div>
  </UiCard>

  <UiModal
    :show="variantImageModal.show"
    :title="`Imágenes de variante: ${selectedVariantForImage?.name ?? ''}`"
    @close="closeVariantImageManager"
  >
    <div class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <UiFileInput accept="image/*" size="lg" label="Subir imagen" @change="onVariantImageFileSelected" />
        <UiInput v-model="variantImageModal.altText" label="Texto alternativo" size="lg" placeholder="Opcional" />
      </div>
      <FormToggleField v-model="variantImageModal.isMain" label="Marcar como principal" size="lg" />
      <UiButton class="w-full" :loading="variantImageModal.loading" :disabled="!variantImageModal.file" @click="uploadAndAttachVariantImage">
        Subir y asociar a la variante
      </UiButton>

      <div class="divider" />

      <div>
        <p class="text-sm font-medium text-surface-700 mb-2">Usar imágenes del producto actual</p>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="img in sortedImages"
            :key="`source-${img.id}`"
            type="button"
            class="aspect-square rounded-lg overflow-hidden border border-surface-200 hover:border-primary-300"
            :disabled="variantImageModal.loading"
            @click="attachExistingProductImageToVariant(img)"
          >
            <img :src="img.url" :alt="img.altText ?? formName" class="h-full w-full object-cover" />
          </button>
        </div>
        <p v-if="!sortedImages.length" class="text-xs text-surface-500 mt-2">
          Primero agrega imágenes al producto base para poder reutilizarlas.
        </p>
      </div>

      <div class="divider" />

      <div>
        <p class="text-sm font-medium text-surface-700 mb-2">Imágenes actuales de la variante</p>
        <UiEmptyState v-if="!variantSortedImages.length" title="Sin imágenes" compact />
        <div v-else class="grid grid-cols-2 gap-2">
          <div
            v-for="img in variantSortedImages"
            :key="`variant-${img.id}`"
            class="aspect-square rounded-lg overflow-hidden bg-surface-100 relative group"
          >
            <img :src="img.url" :alt="img.altText ?? selectedVariantForImage?.name" class="w-full h-full object-cover" />
            <span v-if="img.isMain" class="absolute top-1 left-1 badge-base bg-primary-600 text-white text-xs">
              Principal
            </span>
            <div class="absolute inset-x-1 bottom-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <UiButton
                size="sm"
                variant="secondary"
                class="flex-1"
                :disabled="img.isMain || variantImageModal.actionLoading === img.id"
                @click="setVariantImageAsMain(img)"
              >
                Principal
              </UiButton>
              <UiButton
                size="sm"
                variant="danger"
                class="flex-1"
                :loading="variantImageModal.actionLoading === img.id"
                @click="removeVariantImage(img)"
              >
                Borrar
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </UiModal>
</template>