<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { productsService } from '@/services/products.service'
import { categoriesService, sizesService, colorsService } from '@/services/catalog.service'
import { extractErrorMessage } from '@/utils/error'
import type { Product, Category, Size, Color } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiModal from '@/components/ui/UiModal.vue'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const id = computed(() => String(route.params.id ?? ''))
const isEdit = computed(() => !!id.value)

const loading = ref(false)
const saving  = ref(false)
const addingVariant = ref(false)

const categories = ref<Category[]>([])
const sizes = ref<Size[]>([])
const colors = ref<Color[]>([])

const form = reactive({
  name: '',
  description: '',
  basePrice: 0,
  categoryId: '',
  isActive: true,
  isFeatured: false,
})

const product = ref<Product | null>(null)

const variantModal = reactive({
  show: false,
  sku: '',
  sizeId: '',
  colorId: '',
  stock: 0,
  additionalPrice: 0,
  isActive: true,
})

async function loadCatalogData() {
  const [cats, sz, cl] = await Promise.all([
    categoriesService.list(),
    sizesService.list(),
    colorsService.list(),
  ])
  categories.value = cats
  sizes.value = sz
  colors.value = cl
}

async function loadProduct() {
  if (!isEdit.value) return
  loading.value = true
  try {
    const p = await productsService.get(id.value)
    product.value = p

    form.name = p.name
    form.description = p.description ?? ''
    form.basePrice = Number(p.basePrice)
    form.categoryId = p.category?.id ?? ''
    form.isActive = p.isActive
    form.isFeatured = p.isFeatured
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const payload = {
      name: form.name,
      description: form.description || undefined,
      basePrice: Number(form.basePrice),
      categoryId: form.categoryId,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
    }

    if (isEdit.value) {
      await productsService.update(id.value, payload)
      toast.success('Guardado', 'Producto actualizado')
      await loadProduct()
    } else {
      const created = await productsService.create(payload)
      toast.success('Creado', 'Producto creado correctamente')
      router.push({ name: 'products-edit', params: { id: created.id } })
    }
  } catch (e) {
    toast.error('Error', extractErrorMessage(e, 'No se pudo guardar'))
  } finally {
    saving.value = false
  }
}

async function addVariant() {
  if (!product.value) return
  addingVariant.value = true
  try {
    await productsService.createVariant(product.value.id, {
      sku: variantModal.sku,
      sizeId: variantModal.sizeId,
      colorId: variantModal.colorId,
      stock: Number(variantModal.stock),
      additionalPrice: Number(variantModal.additionalPrice),
      isActive: variantModal.isActive,
    })

    toast.success('Variante agregada', 'La variante se creó correctamente')
    variantModal.show = false
    variantModal.sku = ''
    variantModal.sizeId = ''
    variantModal.colorId = ''
    variantModal.stock = 0
    variantModal.additionalPrice = 0
    variantModal.isActive = true
    await loadProduct()
  } catch (e) {
    toast.error('Error', extractErrorMessage(e, 'No se pudo crear la variante'))
  } finally {
    addingVariant.value = false
  }
}

async function removeVariant(variantId: string) {
  if (!product.value) return
  if (!window.confirm('¿Eliminar esta variante?')) return
  try {
    await productsService.removeVariant(product.value.id, variantId)
    toast.success('Eliminada', 'Variante eliminada')
    await loadProduct()
  } catch {
    toast.error('Error', 'No se pudo eliminar la variante')
  }
}

onMounted(async () => {
  try {
    await loadCatalogData()
    await loadProduct()
  } catch {
    toast.error('Error', 'No se pudieron cargar datos iniciales')
  }
})

function fmt(n: number | string) {
  return Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })
}
</script>

<template>
  <div class="space-y-6">
    <UiCard :title="isEdit ? 'Editar producto' : 'Nuevo producto'">
      <form class="grid grid-cols-1 lg:grid-cols-2 gap-4" @submit.prevent="save">
        <UiInput v-model="form.name" label="Nombre" required placeholder="Remera Oversize" />
        <UiSelect
          v-model="form.categoryId"
          label="Categoría"
          required
          :options="categories.map(c => ({ value: c.id, label: c.name }))"
          placeholder="Seleccionar categoría"
        />

        <UiInput v-model="form.basePrice" type="number" min="0" step="0.01" label="Precio base" required />

        <div class="flex items-center gap-6 pt-7">
          <label class="flex items-center gap-2 text-sm text-[--color-surface-700]">
            <input v-model="form.isActive" type="checkbox" class="accent-[--color-primary-600]" />
            Activo
          </label>
          <label class="flex items-center gap-2 text-sm text-[--color-surface-700]">
            <input v-model="form.isFeatured" type="checkbox" class="accent-[--color-primary-600]" />
            Destacado
          </label>
        </div>

        <div class="lg:col-span-2">
          <UiTextarea v-model="form.description" label="Descripción" :rows="4" placeholder="Detalles del producto…" />
        </div>

        <div class="lg:col-span-2 flex justify-end gap-3">
          <UiButton variant="secondary" @click="router.push({ name: 'products' })">
            Cancelar
          </UiButton>
          <UiButton type="submit" :loading="saving">
            {{ isEdit ? 'Guardar cambios' : 'Crear producto' }}
          </UiButton>
        </div>
      </form>
    </UiCard>

    <UiCard v-if="isEdit && product" title="Variantes">
      <template #default>
        <div class="flex justify-end mb-4">
          <UiButton @click="variantModal.show = true">Agregar variante</UiButton>
        </div>

        <div v-if="!product.variants.length" class="text-muted text-center py-8">
          No hay variantes cargadas
        </div>

        <div v-else class="overflow-x-auto -mx-6 -mb-6">
          <table class="table-base">
            <thead>
              <tr>
                <th class="table-th">SKU</th>
                <th class="table-th">Talla</th>
                <th class="table-th">Color</th>
                <th class="table-th text-right">Precio extra</th>
                <th class="table-th text-center">Stock</th>
                <th class="table-th text-center">Estado</th>
                <th class="table-th" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in product.variants" :key="v.id" class="table-tr-hover">
                <td class="table-td font-mono text-xs">{{ v.sku }}</td>
                <td class="table-td">{{ v.size.name }}</td>
                <td class="table-td">
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full border border-[--color-surface-300]" :style="{ backgroundColor: v.color.hexCode }" />
                    {{ v.color.name }}
                  </div>
                </td>
                <td class="table-td text-right">{{ fmt(v.additionalPrice) }}</td>
                <td class="table-td text-center">{{ v.stock }}</td>
                <td class="table-td text-center">
                  <UiBadge :color="v.isActive ? 'success' : 'neutral'" dot>
                    {{ v.isActive ? 'Activa' : 'Inactiva' }}
                  </UiBadge>
                </td>
                <td class="table-td text-right">
                  <UiButton variant="danger" size="sm" @click="removeVariant(v.id)">Eliminar</UiButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </UiCard>

    <UiModal :show="variantModal.show" title="Nueva variante" @close="variantModal.show = false">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UiInput v-model="variantModal.sku" label="SKU" required placeholder="SKU-TSHIRT-BLK-M" />
        <UiInput v-model="variantModal.stock" type="number" min="0" label="Stock" required />

        <UiSelect
          v-model="variantModal.sizeId"
          label="Talla"
          required
          :options="sizes.map(s => ({ value: s.id, label: s.name }))"
          placeholder="Seleccionar talla"
        />

        <UiSelect
          v-model="variantModal.colorId"
          label="Color"
          required
          :options="colors.map(c => ({ value: c.id, label: c.name }))"
          placeholder="Seleccionar color"
        />

        <UiInput
          v-model="variantModal.additionalPrice"
          type="number"
          min="0"
          step="0.01"
          label="Precio adicional"
          hint="Se suma al precio base del producto"
        />

        <div class="flex items-center pt-7">
          <label class="flex items-center gap-2 text-sm text-[--color-surface-700]">
            <input v-model="variantModal.isActive" type="checkbox" class="accent-[--color-primary-600]" />
            Activa
          </label>
        </div>
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="variantModal.show = false">Cancelar</UiButton>
        <UiButton :loading="addingVariant" @click="addVariant">Guardar variante</UiButton>
      </template>
    </UiModal>
  </div>
</template>
