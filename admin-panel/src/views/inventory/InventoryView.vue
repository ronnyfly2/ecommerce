<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
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

const toast = useToast()
const pg = usePagination(20)
const router = useRouter()
const route = useRoute()

const movements = ref<InventoryMovement[]>([])
const products = ref<Product[]>([])
const loading = ref(false)
const initialized = ref(false)

const modal = reactive({
  show: false,
  loading: false,
  variantId: '',
  quantityChange: 0,
  type: InventoryMovementType.ADJUSTMENT as InventoryMovementType,
  reason: '',
})

const filters = reactive({ variantId: '' })

function syncQuery() {
  const query: Record<string, string> = {}
  if (pg.page.value > 1) query.page = String(pg.page.value)
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
  if (type === InventoryMovementType.PURCHASE || type === InventoryMovementType.RETURN) return 'text-[--color-success-600]'
  if (type === InventoryMovementType.SALE) return 'text-[--color-danger-600]'
  return 'text-[--color-info-600]'
}

async function loadProducts() {
  const data = await productsService.list({ page: 1, limit: 100 })
  products.value = normalizeApiList(data).items
}

function variantOptions() {
  const result: { value: string; label: string }[] = [{ value: '', label: 'Todas las variantes' }]
  for (const product of products.value) {
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
  loading.value = true
  try {
    const data = await inventoryService.movements({
      page: pg.page.value,
      limit: pg.limit.value,
      variantId: filters.variantId || undefined,
    })
    const result = normalizeApiList(data)
    movements.value = result.items
    pg.total.value = result.total
  } catch {
    toast.error('Error', 'No se pudieron cargar movimientos de inventario')
  } finally {
    loading.value = false
  }
}

watch([() => pg.page.value, () => filters.variantId], async () => {
  if (!initialized.value) return
  syncQuery()
  await loadMovements()
})

function openAdjustment() {
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
      variantId: modal.variantId,
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
    <div class="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
      <UiSelect
        v-model="filters.variantId"
        :options="variantOptions()"
        class="lg:min-w-[460px]"
      />
      <UiButton @click="openAdjustment">
        <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Registrar ajuste
      </UiButton>
    </div>

    <UiCard :padding="false">
      <div v-if="loading" class="p-6 space-y-3">
        <div v-for="i in 8" :key="i" class="h-11 rounded-lg bg-[--color-surface-100] animate-pulse" />
      </div>

      <div v-else-if="!movements.length" class="text-muted text-center py-16">
        Sin movimientos de inventario
      </div>

      <div v-else class="overflow-x-auto -mb-6">
        <table class="table-base">
          <thead>
            <tr>
              <th class="table-th">Fecha</th>
              <th class="table-th">Producto / Variante</th>
              <th class="table-th">Tipo</th>
              <th class="table-th text-right">Cantidad</th>
              <th class="table-th">Motivo</th>
              <th class="table-th">Usuario</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in movements" :key="m.id" class="table-tr-hover">
              <td class="table-td text-xs text-muted">{{ new Date(m.createdAt).toLocaleString('es-AR') }}</td>
              <td class="table-td">
                <div class="font-medium text-[--color-surface-900]">{{ m.variant.product?.name ?? 'Producto' }}</div>
                <div class="text-xs text-muted">{{ m.variant.sku }} · {{ m.variant.size.name }}/{{ m.variant.color.name }}</div>
              </td>
              <td class="table-td">{{ m.movementType }}</td>
              <td :class="['table-td text-right font-semibold', movementColor(m.movementType)]">
                {{ m.quantityChange > 0 ? '+' : '' }}{{ m.quantityChange }}
              </td>
              <td class="table-td text-muted">{{ m.reason || '—' }}</td>
              <td class="table-td">{{ m.createdBy.email }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="p-4 border-t border-[--color-surface-200]">
        <UiPagination
          :page="pg.page.value"
          :total-pages="pg.totalPages.value"
          :total="pg.total.value"
          @change="pg.goTo"
        />
      </div>
    </UiCard>

    <UiModal :show="modal.show" title="Registrar movimiento" @close="modal.show = false">
      <div class="grid grid-cols-1 gap-4">
        <UiSelect
          v-model="modal.variantId"
          label="Variante"
          :options="variantOptions().filter(o => o.value !== '')"
        />
        <UiSelect
          v-model="modal.type"
          label="Tipo de movimiento"
          :options="typeOptions"
        />
        <UiInput
          v-model="modal.quantityChange"
          type="number"
          label="Cantidad (+/-)"
          hint="Usa negativo para salida y positivo para entrada"
        />
        <UiInput v-model="modal.reason" label="Motivo" placeholder="Ajuste por conteo físico" />
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="modal.show = false">Cancelar</UiButton>
        <UiButton :loading="modal.loading" @click="saveAdjustment">Guardar</UiButton>
      </template>
    </UiModal>
  </div>
</template>
