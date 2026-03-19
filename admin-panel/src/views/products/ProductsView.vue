<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { productsService } from '@/services/products.service'
import type { Product } from '@/types/api'
import { useToast } from '@/composables/useToast'
import { usePagination } from '@/composables/usePagination'
import { normalizeApiList } from '@/utils/api-list'
import UiCard from '@/components/ui/UiCard.vue'
import UiTable from '@/components/ui/UiTable.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'

const router = useRouter()
const route = useRoute()
const toast  = useToast()
const pg     = usePagination(15)

const products  = ref<Product[]>([])
const loading   = ref(false)
const search    = ref('')
const confirm   = reactive({ show: false, id: '', name: '', loading: false })
const initialized = ref(false)

function syncQuery() {
  const query: Record<string, string> = {}
  if (pg.page.value > 1) query.page = String(pg.page.value)
  if (search.value.trim()) query.search = search.value.trim()
  router.replace({ query })
}

async function load() {
  loading.value = true
  try {
    const data = await productsService.list({ page: pg.page.value, limit: pg.limit.value, search: search.value || undefined })
    const result = normalizeApiList(data)
    products.value = result.items
    pg.total.value = result.total
  } catch {
    toast.error('Error', 'No se pudo cargar los productos')
  } finally {
    loading.value = false
  }
}

watch([() => pg.page.value, search], async () => {
  if (!initialized.value) return
  syncQuery()
  await load()
})

onMounted(async () => {
  const page = Number(route.query.page ?? 1)
  pg.page.value = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  search.value = typeof route.query.search === 'string' ? route.query.search : ''
  initialized.value = true
  await load()
})

function askDelete(p: Product) {
  confirm.id = p.id
  confirm.name = p.name
  confirm.show = true
}

async function doDelete() {
  confirm.loading = true
  try {
    await productsService.remove(confirm.id)
    toast.success('Eliminado', `"${confirm.name}" fue eliminado`)
    confirm.show = false
    load()
  } catch {
    toast.error('Error', 'No se pudo eliminar el producto')
  } finally {
    confirm.loading = false
  }
}

function fmt(n: string | number) {
  return Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })
}
</script>

<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
      <input
        v-model="search"
        class="input-base max-w-xs"
        placeholder="Buscar productos…"
      />
      <UiButton @click="router.push({ name: 'products-new' })">
        <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Nuevo producto
      </UiButton>
    </div>

    <!-- Tabla -->
    <UiCard :padding="false">
      <UiTable :loading="loading" :empty="!loading && !products.length" empty-message="No hay productos">
        <template #head>
          <tr>
            <th class="table-th">Producto</th>
            <th class="table-th">Categoría</th>
            <th class="table-th text-right">Precio base</th>
            <th class="table-th text-center">Variantes</th>
            <th class="table-th text-center">Estado</th>
            <th class="table-th table-actions-th" />
          </tr>
        </template>

        <tr
          v-for="p in products"
          :key="p.id"
          class="table-tr-hover"
        >
          <td class="table-td">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-lg overflow-hidden bg-[--color-surface-100] shrink-0"
              >
                <img
                  v-if="p.images?.[0]?.url"
                  :src="p.images[0].url"
                  :alt="p.name"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full flex items-center justify-center text-[--color-surface-300]">
                  <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
              </div>
              <div>
                <p class="font-medium text-[--color-surface-900]">{{ p.name }}</p>
                <p class="text-caption">{{ p.slug }}</p>
              </div>
            </div>
          </td>
          <td class="table-td text-muted">{{ p.category?.name ?? '—' }}</td>
          <td class="table-td text-right font-medium">{{ fmt(p.basePrice) }}</td>
          <td class="table-td text-center">
            <span class="text-muted">{{ p.variants?.length ?? 0 }}</span>
          </td>
          <td class="table-td text-center">
            <UiBadge :color="p.isActive ? 'success' : 'neutral'" dot>
              {{ p.isActive ? 'Activo' : 'Inactivo' }}
            </UiBadge>
          </td>
          <td class="table-td table-actions-td">
            <div class="flex items-center gap-1 justify-end">
              <UiButton
                variant="ghost"
                size="sm"
                @click="router.push({ name: 'products-detail', params: { id: p.id } })"
              >
                Ver
              </UiButton>
              <UiButton
                variant="ghost"
                size="sm"
                @click="router.push({ name: 'products-edit', params: { id: p.id } })"
              >
                Editar
              </UiButton>
              <UiButton variant="danger" size="sm" @click="askDelete(p)">
                Eliminar
              </UiButton>
            </div>
          </td>
        </tr>

        <template #empty-actions>
          <UiButton size="sm" @click="search = ''">Limpiar búsqueda</UiButton>
        </template>
      </UiTable>

      <div class="p-4 border-t border-[--color-surface-200]">
        <UiPagination
          :page="pg.page.value"
          :total-pages="pg.totalPages.value"
          :total="pg.total.value"
          @change="pg.goTo"
        />
      </div>
    </UiCard>

    <UiConfirm
      :show="confirm.show"
      title="Eliminar producto"
      :message="`¿Eliminar &quot;${confirm.name}&quot;? Esta acción no se puede deshacer.`"
      confirm-label="Eliminar"
      :loading="confirm.loading"
      @confirm="doDelete"
      @cancel="confirm.show = false"
    />
  </div>
</template>
