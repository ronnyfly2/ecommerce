<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed, toRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { inventoryService } from '@/services/inventory.service'
import { productsService } from '@/services/products.service'
import { InventoryMovementType } from '@/types/api'
import type { InventoryMovement, Product } from '@/types/api'
import { useToast } from '@/composables/useToast'
import { usePagination } from '@/composables/usePagination'
import { normalizeApiList } from '@/utils/api-list'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiTable from '@/components/ui/UiTable.vue'
import FormModalActions from '@/components/forms/FormModalActions.vue'
import FormModalLayout from '@/components/forms/FormModalLayout.vue'
import ListViewToolbar from '@/components/shared/ListViewToolbar.vue'
import { useAuthStore } from '@/stores/auth'

const toast = useToast()
const pg = usePagination(20)
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const movements = ref<InventoryMovement[] | null>(null)
const products = ref<Product[]>([])
const initialized = ref(false)
const tableLoading = computed(() => movements.value === null)
const tableEmpty = computed(() => !tableLoading.value && (movements.value?.length ?? 0) === 0)
const canManageInventory = computed(() => auth.can('inventory.manage'))

const modal = reactive({
  show: false,
  loading: false,
  productId: '',
  variantId: '',
  quantityChange: 0,
  type: InventoryMovementType.ADJUSTMENT as InventoryMovementType,
  reason: '',
})

const filters = reactive({ productId: '', variantId: '' })
const productIdFilter = toRef(filters, 'productId')
const variantIdFilter = toRef(filters, 'variantId')

function syncQuery() {
  const query: Record<string, string> = {}
  if (pg.page.value > 1) query.page = String(pg.page.value)
  if (filters.productId) query.productId = filters.productId
  if (filters.variantId) query.variantId = filters.variantId
  router.replace({ query })
}

const typeOptions = [
  { value: InventoryMovementType.PURCHASE, label: 'Compra' },
  { value: InventoryMovementType.SALE, label: 'Venta' },
  { value: InventoryMovementType.ADJUSTMENT, label: 'Ajuste' },
  { value: InventoryMovementType.RETURN, label: 'Devolución' },
]

function movementColor(type: InventoryMovementType) {
  if (type === InventoryMovementType.PURCHASE || type === InventoryMovementType.RETURN) return 'text-success-600'
  if (type === InventoryMovementType.SALE) return 'text-danger-600'
  return 'text-info-600'
}

async function loadProducts() {
  const data = await productsService.list({ page: 1, limit: 100 })
  products.value = normalizeApiList(data).items
}

function productOptions() {
  return [
    { value: '', label: 'Todos los productos' },
    ...products.value.map((product) => ({ value: product.id, label: `${product.name} · ${product.sku}` })),
  ]
}

function variantOptions(productId?: string) {
  const result: { value: string; label: string }[] = [{ value: '', label: 'Todas las versiones' }]
  for (const product of products.value) {
    if (productId && product.id !== productId) {
      continue
    }

    for (const variant of product.variants ?? []) {
      result.push({
        value: variant.id,
        label: `${product.name} · ${variant.sku} · ${variant.size.name}/${variant.color.name}`,
      })
    }
  }
  return result
}

async function loadMovements() {
  movements.value = null
  try {
    const data = await inventoryService.movements({
      page: pg.page.value,
      limit: pg.limit.value,
      productId: filters.productId || undefined,
      variantId: filters.variantId || undefined,
    })
    const result = normalizeApiList(data)
    movements.value = result.items
    pg.total.value = result.total
  } catch {
    movements.value = []
    toast.error('Error', 'No se pudieron cargar movimientos de inventario')
  }
}

watch([pg.page, productIdFilter, variantIdFilter], async () => {
  if (!initialized.value) return
  syncQuery()
  await loadMovements()
})

watch(productIdFilter, (nextProductId) => {
  if (!nextProductId) {
    return
  }

  const options = variantOptions(nextProductId)
  if (!options.some((option) => option.value === filters.variantId)) {
    filters.variantId = ''
  }
})

function openAdjustment() {
  modal.productId = ''
  modal.variantId = ''
  modal.quantityChange = 0
  modal.type = InventoryMovementType.ADJUSTMENT
  modal.reason = ''
  modal.show = true
}

async function saveAdjustment() {
  modal.loading = true
  try {
    await inventoryService.adjust({
      productId: modal.productId || undefined,
      variantId: modal.variantId || undefined,
      quantityChange: Number(modal.quantityChange),
      type: modal.type,
      reason: modal.reason || undefined,
    })
    toast.success('Movimiento registrado')
    modal.show = false
    await loadMovements()
  } catch (e: unknown) {
    const msg =
      typeof e === 'object' &&
      e !== null &&
      'response' in e &&
      typeof (e as { response?: { data?: { message?: unknown } } }).response?.data?.message !== 'undefined'
        ? (e as { response?: { data?: { message?: unknown } } }).response?.data?.message
        : undefined
    toast.error('Error', Array.isArray(msg) ? msg[0] : (msg ?? 'No se pudo registrar el movimiento'))
  } finally {
    modal.loading = false
  }
}

onMounted(async () => {
  try {
    await loadProducts()
    const page = Number(route.query.page ?? 1)
    pg.page.value = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
    filters.productId = typeof route.query.productId === 'string' ? route.query.productId : ''
    filters.variantId = typeof route.query.variantId === 'string' ? route.query.variantId : ''
    initialized.value = true
    await loadMovements()
  } catch {
    toast.error('Error', 'No se pudieron cargar productos para inventario')
  }
})
</script>

<template>
  <div class="space-y-4">
    <ListViewToolbar>
      <template #filters>
        <div class="grid w-full gap-3 sm:grid-cols-2">
          <UiSelect
            v-model="filters.productId"
            searchable
            size="sm"
            search-placeholder="Buscar producto..."
            :options="productOptions()"
            class="w-full"
          />
          <UiSelect
            v-model="filters.variantId"
            searchable
            size="sm"
            search-placeholder="Buscar versión..."
            :options="variantOptions(filters.productId)"
            class="w-full"
          />
        </div>
      </template>
      <template #actions>
        <UiButton v-if="canManageInventory" @click="openAdjustment">
          <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo movimiento
        </UiButton>
      </template>
    </ListViewToolbar>

    <UiCard :padding="false">
      <UiTable :data="movements" :loading="tableLoading" :empty="tableEmpty" loading-color="primary" loading-text="Cargando movimientos..." empty-message="Sin movimientos de inventario">
        <template #head>
          <tr>
            <th class="table-th">Fecha</th>
            <th class="table-th">Producto / Variante</th>
            <th class="table-th">Tipo</th>
            <th class="table-th text-right">Cantidad</th>
            <th class="table-th">Motivo</th>
            <th class="table-th">Usuario</th>
          </tr>
        </template>

        <tr v-for="m in movements ?? []" :key="m.id" class="table-tr-hover">
          <td class="table-td text-xs text-muted">{{ new Date(m.createdAt).toLocaleString('es-AR') }}</td>
          <td class="table-td">
            <div class="font-medium text-surface-900">{{ m.product?.name ?? m.variant?.product?.name ?? 'Producto' }}</div>
            <div class="text-xs text-muted">
              {{ m.variant ? `${m.variant.sku} · ${m.variant.size.name}/${m.variant.color.name}` : `${m.product?.sku ?? 'SIN-SKU'} · movimiento directo` }}
            </div>
          </td>
          <td class="table-td">{{ m.movementType }}</td>
          <td :class="['table-td text-right font-semibold', movementColor(m.movementType)]">
            {{ m.quantityChange > 0 ? '+' : '' }}{{ m.quantityChange }}
          </td>
          <td class="table-td text-muted">{{ m.reason || '—' }}</td>
          <td class="table-td">{{ m.createdBy.email }}</td>
        </tr>

        <template #empty-actions>
          <UiButton v-if="canManageInventory" size="sm" @click="openAdjustment">Nuevo movimiento</UiButton>
        </template>
      </UiTable>

      <div class="p-4 border-t border-surface-200">
        <UiPagination
          :page="pg.page.value"
          :total-pages="pg.totalPages.value"
          :total="pg.total.value"
          @change="pg.goTo"
        />
      </div>
    </UiCard>

    <UiModal v-if="canManageInventory" :show="modal.show" title="Nuevo movimiento" @close="modal.show = false">
      <FormModalLayout :columns="1">
        <UiSelect
          v-model="modal.productId"
          label="Producto"
          searchable
          size="lg"
          search-placeholder="Buscar producto..."
          :options="productOptions().filter(o => o.value !== '')"
        />
        <UiSelect
          v-model="modal.variantId"
          label="Versión vinculada"
          searchable
          size="lg"
          search-placeholder="Buscar versión..."
          :options="variantOptions(modal.productId || undefined).filter(o => o.value !== '')"
        />
        <UiSelect
          v-model="modal.type"
          label="Tipo de movimiento"
          size="lg"
          :options="typeOptions"
        />
        <UiInput
          v-model="modal.quantityChange"
          type="number"
          label="Cantidad (+/-)"
          size="lg"
          hint="Usa negativo para salida y positivo para entrada"
        />
        <UiInput v-model="modal.reason" label="Motivo" size="lg" placeholder="Ajuste por conteo físico" />
      </FormModalLayout>

      <template #footer>
        <FormModalActions :loading="modal.loading" @cancel="modal.show = false" @save="saveAdjustment" />
      </template>
    </UiModal>
  </div>
</template>
