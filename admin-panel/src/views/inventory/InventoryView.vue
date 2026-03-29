<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed, toRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { inventoryService } from '@/services/inventory.service'
import { productsService } from '@/services/products.service'
import { InventoryMovementType, InventoryChannel } from '@/types/api'
import type { InventoryMovement, Product, Store, ProductStockOverview } from '@/types/api'
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
const stores = ref<Store[]>([])
const initialized = ref(false)
const tableLoading = computed(() => movements.value === null)
const tableEmpty = computed(() => !tableLoading.value && (movements.value?.length ?? 0) === 0)
const canManageInventory = computed(() => auth.can('inventory.manage'))

const stockEditor = reactive({
  productId: '',
  loading: false,
  saving: false,
  deliveryStock: 0,
  pickupStocks: {} as Record<string, number>,
})
const stockOverview = ref<ProductStockOverview | null>(null)

const modal = reactive({
  show: false,
  loading: false,
  productId: '',
  variantId: '',
  channelType: InventoryChannel.DELIVERY as InventoryChannel,
  storeId: '',
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

const channelOptions = [
  { value: InventoryChannel.DELIVERY, label: 'Delivery / Online' },
  { value: InventoryChannel.PICKUP, label: 'Retiro en tienda' },
]

function channelLabel(channel: InventoryMovement['channelType']) {
  if (channel === InventoryChannel.PICKUP) {
    return 'Retiro tienda'
  }

  if (channel === InventoryChannel.DELIVERY) {
    return 'Delivery'
  }

  return 'General'
}

function movementColor(type: InventoryMovementType) {
  if (type === InventoryMovementType.PURCHASE || type === InventoryMovementType.RETURN) return 'text-success-600'
  if (type === InventoryMovementType.SALE) return 'text-danger-600'
  return 'text-info-600'
}

async function loadProducts() {
  const data = await productsService.list({ page: 1, limit: 100 })
  products.value = normalizeApiList(data).items
}

async function loadStores() {
  stores.value = await inventoryService.stores()
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
  modal.channelType = InventoryChannel.DELIVERY
  modal.storeId = ''
  modal.quantityChange = 0
  modal.type = InventoryMovementType.ADJUSTMENT
  modal.reason = ''
  modal.show = true
}

async function saveAdjustment() {
  if (modal.channelType === InventoryChannel.PICKUP && !modal.storeId) {
    toast.warning('Tienda requerida', 'Selecciona una tienda para el canal de retiro')
    return
  }

  modal.loading = true
  try {
    await inventoryService.adjust({
      productId: modal.productId || undefined,
      variantId: modal.variantId || undefined,
      channelType: modal.channelType,
      storeId: modal.channelType === InventoryChannel.PICKUP ? modal.storeId || undefined : undefined,
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

async function loadStockOverview() {
  if (!stockEditor.productId) {
    stockOverview.value = null
    return
  }

  stockEditor.loading = true
  try {
    const data = await inventoryService.getProductStock(stockEditor.productId)
    stockOverview.value = data
    stockEditor.deliveryStock = data.deliveryStock
    stockEditor.pickupStocks = Object.fromEntries(
      data.pickupStocks.map((item) => [item.storeId, item.stock]),
    )
  } catch {
    toast.error('Error', 'No se pudo cargar el stock del producto')
  } finally {
    stockEditor.loading = false
  }
}

async function saveStockOverview() {
  if (!stockEditor.productId) {
    toast.warning('Producto requerido', 'Selecciona un producto para editar stock')
    return
  }

  stockEditor.saving = true
  try {
    const data = await inventoryService.upsertProductStock(stockEditor.productId, {
      deliveryStock: Number(stockEditor.deliveryStock),
      pickupStocks: stores.value.map((store) => ({
        storeId: store.id,
        stock: Number(stockEditor.pickupStocks[store.id] ?? 0),
      })),
    })

    stockOverview.value = data
    toast.success('Stock actualizado')
    await loadMovements()
  } catch {
    toast.error('Error', 'No se pudo actualizar el stock')
  } finally {
    stockEditor.saving = false
  }
}

const storeOptions = computed(() => [
  { value: '', label: 'Seleccionar tienda' },
  ...stores.value.map((store) => ({ value: store.id, label: `${store.code} · ${store.name}` })),
])

watch(() => modal.channelType, (channel) => {
  if (channel !== InventoryChannel.PICKUP) {
    modal.storeId = ''
  }
})

watch(() => stockEditor.productId, async () => {
  await loadStockOverview()
})

onMounted(async () => {
  try {
    await Promise.all([loadProducts(), loadStores()])
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
    <UiCard v-if="canManageInventory" title="Stock por canal y tienda">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <UiSelect
          v-model="stockEditor.productId"
          searchable
          label="Producto"
          size="lg"
          search-placeholder="Buscar producto..."
          :options="productOptions().filter(option => option.value !== '')"
        />

        <UiInput
          v-model="stockEditor.deliveryStock"
          type="number"
          min="0"
          label="Stock Delivery / Online"
          size="lg"
          :disabled="!stockEditor.productId || stockEditor.loading"
        />

        <div class="flex items-end">
          <UiButton class="w-full" :loading="stockEditor.saving" :disabled="!stockEditor.productId || stockEditor.loading" @click="saveStockOverview">
            Guardar stock
          </UiButton>
        </div>
      </div>

      <div v-if="stockEditor.productId" class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <UiInput
          v-for="store in stores"
          :key="store.id"
          v-model="stockEditor.pickupStocks[store.id]"
          type="number"
          min="0"
          :label="`Stock Retiro · ${store.code}`"
          size="lg"
          :disabled="stockEditor.loading"
        />
      </div>

      <p v-if="stockOverview" class="mt-3 text-sm text-surface-700">
        Stock total actual: <strong>{{ stockOverview.totalStock }}</strong>
      </p>
    </UiCard>

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
            <th class="table-th">Canal</th>
            <th class="table-th">Tienda</th>
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
          <td class="table-td text-muted">{{ channelLabel(m.channelType) }}</td>
          <td class="table-td text-muted">{{ m.store?.code ?? '—' }}</td>
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
        <UiSelect
          v-model="modal.channelType"
          label="Canal"
          size="lg"
          :options="channelOptions"
        />
        <UiSelect
          v-if="modal.channelType === InventoryChannel.PICKUP"
          v-model="modal.storeId"
          label="Tienda"
          size="lg"
          :options="storeOptions"
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
