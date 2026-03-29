<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { inventoryService } from '@/services/inventory.service'
import { usePagination } from '@/composables/usePagination'
import { normalizeApiList } from '@/utils/api-list'
import type { ProductStockListItem, Store, QueryProductStocksDto } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiTable from '@/components/ui/UiTable.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import ListViewToolbar from '@/components/shared/ListViewToolbar.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const pg = usePagination(20)

const loading = ref(false)
const saving = ref(false)
const rowSaving = ref<Record<string, boolean>>({})
const items = ref<ProductStockListItem[]>([])
const stores = ref<Store[]>([])

const filters = reactive({
  search: '',
  lowStockThreshold: 5,
  storeId: '',
})

type StockDraft = { deliveryStock: number; pickupStocks: Record<string, number> }
const draft = reactive({ byProduct: {} as Record<string, StockDraft> })
const original = reactive({ byProduct: {} as Record<string, StockDraft> })

const tableEmpty = computed(() => !loading.value && items.value.length === 0)

const storeOptions = computed(() => [
  { value: '', label: 'Todas las tiendas' },
  ...stores.value.map((s) => ({ value: s.id, label: s.name })),
])

const dirtyCount = computed(() =>
  items.value.filter((row) => isRowDirty(row.productId)).length,
)

function initializeDraft(rows: ProductStockListItem[]) {
  const makeEntry = (row: ProductStockListItem): StockDraft => ({
    deliveryStock: row.deliveryStock,
    pickupStocks: Object.fromEntries(row.pickupStocks.map((s) => [s.storeId, s.stock])),
  })
  draft.byProduct = Object.fromEntries(rows.map((row) => [row.productId, makeEntry(row)]))
  original.byProduct = Object.fromEntries(rows.map((row) => [row.productId, makeEntry(row)]))
}

function rowDraft(row: ProductStockListItem) {
  return draft.byProduct[row.productId]
}

function isLowStore(row: ProductStockListItem, storeId: string) {
  return row.alerts.lowPickupStoreIds.includes(storeId)
}

function isDirtyDelivery(productId: string) {
  return draft.byProduct[productId]?.deliveryStock !== original.byProduct[productId]?.deliveryStock
}

function isDirtyPickup(productId: string, storeId: string) {
  return draft.byProduct[productId]?.pickupStocks[storeId] !== original.byProduct[productId]?.pickupStocks[storeId]
}

function isRowDirty(productId: string) {
  const d = draft.byProduct[productId]
  const o = original.byProduct[productId]
  if (!d || !o) return false
  if (d.deliveryStock !== o.deliveryStock) return true
  return Object.keys(d.pickupStocks).some((sid) => d.pickupStocks[sid] !== o.pickupStocks[sid])
}

async function load() {
  loading.value = true
  try {
    const params: QueryProductStocksDto = {
      page: pg.page.value,
      limit: pg.limit.value,
      search: filters.search || undefined,
      lowStockThreshold: Number(filters.lowStockThreshold),
      storeId: filters.storeId || undefined,
    }
    const [data, storeList] = await Promise.all([
      inventoryService.productStocks(params),
      stores.value.length ? Promise.resolve(stores.value) : inventoryService.stores(),
    ])

    if (!stores.value.length) stores.value = storeList

    const normalized = normalizeApiList(data)
    items.value = normalized.items
    pg.total.value = normalized.total
    initializeDraft(items.value)
  } catch {
    items.value = []
    pg.total.value = 0
    toast.error('Error', 'No se pudo cargar el stock por producto')
  } finally {
    loading.value = false
  }
}

async function saveRow(row: ProductStockListItem) {
  rowSaving.value[row.productId] = true
  try {
    const d = rowDraft(row)
    await inventoryService.upsertProductStock(row.productId, {
      deliveryStock: Number(d?.deliveryStock ?? 0),
      pickupStocks: row.pickupStocks.map((s) => ({
        storeId: s.storeId,
        stock: Number(d?.pickupStocks[s.storeId] ?? 0),
      })),
    })
    // commit draft to original (no full reload)
    original.byProduct[row.productId] = {
      deliveryStock: Number(d.deliveryStock),
      pickupStocks: Object.fromEntries(
        row.pickupStocks.map((s) => [s.storeId, Number(d.pickupStocks[s.storeId] ?? 0)]),
      ),
    }
    toast.success('Guardado', `Stock de "${row.productName}" actualizado`)
  } catch {
    toast.error('Error', `No se pudo guardar "${row.productName}"`)
  } finally {
    rowSaving.value[row.productId] = false
  }
}

async function saveDirty() {
  const dirty = items.value.filter((row) => isRowDirty(row.productId))
  if (!dirty.length) {
    toast.warning('Sin cambios', 'No hay modificaciones pendientes')
    return
  }
  saving.value = true
  try {
    await inventoryService.bulkUpsertProductStocks({
      items: dirty.map((row) => ({
        productId: row.productId,
        deliveryStock: Number(rowDraft(row)?.deliveryStock ?? 0),
        pickupStocks: row.pickupStocks.map((s) => ({
          storeId: s.storeId,
          stock: Number(rowDraft(row)?.pickupStocks[s.storeId] ?? 0),
        })),
      })),
    })
    toast.success('Stock actualizado', `${dirty.length} producto(s) guardados`)
    await load()
  } catch {
    toast.error('Error', 'No se pudo actualizar el stock')
  } finally {
    saving.value = false
  }
}

function exportCsv() {
  if (!items.value.length) {
    toast.warning('Sin datos', 'No hay productos para exportar')
    return
  }

  const storeHeaders = items.value[0]?.pickupStocks.map((s) => s.storeCode) ?? []
  const headers = ['SKU', 'Producto', 'Delivery', ...storeHeaders, 'Total']

  const rows = items.value.map((row) => {
    const d = rowDraft(row)
    const pickupValues = row.pickupStocks.map((s) => String(d?.pickupStocks[s.storeId] ?? s.stock))
    const total = (d?.deliveryStock ?? row.deliveryStock) + pickupValues.reduce((sum, v) => sum + Number(v), 0)
    return [
      row.sku,
      `"${row.productName}"`,
      String(d?.deliveryStock ?? row.deliveryStock),
      ...pickupValues,
      String(total),
    ]
  })

  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `stock-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

watch(() => pg.page.value, () => load())

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <ListViewToolbar>
      <template #filters>
        <div class="grid w-full grid-cols-1 md:grid-cols-4 gap-3">
          <UiInput
            v-model="filters.search"
            size="sm"
            label="Buscar producto"
            placeholder="Nombre o SKU"
          />
          <UiSelect
            v-model="filters.storeId"
            size="sm"
            label="Filtrar por tienda"
            :options="storeOptions"
          />
          <UiInput
            v-model="filters.lowStockThreshold"
            type="number"
            min="0"
            size="sm"
            label="Umbral alerta"
          />
        </div>
      </template>
      <template #actions>
        <UiButton variant="ghost" size="sm" @click="exportCsv">
          <template #icon>
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
          </template>
          Exportar CSV
        </UiButton>
        <UiButton variant="secondary" size="sm" @click="load">Aplicar filtros</UiButton>
        <UiButton :loading="saving" @click="saveDirty">
          Guardar cambios
          <span v-if="dirtyCount > 0" class="ml-1 bg-white/20 text-white text-xs rounded-full px-1.5 py-0.5">{{ dirtyCount }}</span>
        </UiButton>
      </template>
    </ListViewToolbar>

    <UiCard :padding="false">
      <UiTable :data="items" :loading="loading" :empty="tableEmpty" empty-message="Sin productos">
        <template #head>
          <tr>
            <th class="table-th">Producto</th>
            <th class="table-th">Delivery</th>
            <th class="table-th">Retiro por tienda</th>
            <th class="table-th text-right">Total</th>
            <th class="table-th w-28"></th>
          </tr>
        </template>

        <tr
          v-for="row in items"
          :key="row.productId"
          class="table-tr-hover align-top"
          :class="{ 'bg-amber-50/40': isRowDirty(row.productId) }"
        >
          <td class="table-td">
            <div class="flex items-start gap-2">
              <span
                v-if="isRowDirty(row.productId)"
                class="mt-1 size-2 rounded-full bg-amber-400 shrink-0"
                title="Con cambios sin guardar"
              />
              <div>
                <p class="font-medium text-surface-900">{{ row.productName }}</p>
                <p class="text-xs text-muted font-mono">{{ row.sku }}</p>
              </div>
            </div>
          </td>

          <td class="table-td min-w-36">
            <UiInput
              v-model="draft.byProduct[row.productId].deliveryStock"
              type="number"
              min="0"
              size="sm"
              label="Stock"
              :class="{ 'ring-2 ring-amber-400 ring-offset-1 rounded-md': isDirtyDelivery(row.productId) }"
            />
            <UiBadge v-if="row.alerts.lowDelivery" color="warning" class="mt-2">Bajo</UiBadge>
          </td>

          <td class="table-td">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div v-for="storeStock in row.pickupStocks" :key="`${row.productId}-${storeStock.storeId}`">
                <UiInput
                  v-model="draft.byProduct[row.productId].pickupStocks[storeStock.storeId]"
                  type="number"
                  min="0"
                  size="sm"
                  :label="storeStock.storeCode"
                  :class="{ 'ring-2 ring-amber-400 ring-offset-1 rounded-md': isDirtyPickup(row.productId, storeStock.storeId) }"
                />
                <UiBadge v-if="isLowStore(row, storeStock.storeId)" color="warning" class="mt-1">Bajo</UiBadge>
              </div>
            </div>
          </td>

          <td class="table-td text-right font-semibold">{{ row.totalStock }}</td>

          <td class="table-td">
            <UiButton
              v-if="isRowDirty(row.productId)"
              size="sm"
              variant="secondary"
              :loading="rowSaving[row.productId]"
              @click="saveRow(row)"
            >
              Guardar
            </UiButton>
          </td>
        </tr>
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
  </div>
</template>
