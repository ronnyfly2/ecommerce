<script setup lang="ts">
import { ref, reactive, watch, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { productsService } from '@/services/products.service'
import { currenciesService } from '@/services/currencies.service'
import { categoriesService, tagsService } from '@/services/catalog.service'
import type { Product, Category, Tag, Currency } from '@/types/api'
import { useToast } from '@/composables/useToast'
import { usePagination } from '@/composables/usePagination'
import { normalizeApiList } from '@/utils/api-list'
import { preloadRichEditor } from '@/utils/preload-rich-editor'
import { formatMoney } from '@/utils/currency'
import { getSystemCurrencyCode } from '@/utils/system-currency'
import UiCard from '@/components/ui/UiCard.vue'
import UiTable from '@/components/ui/UiTable.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const toast  = useToast()
const pg     = usePagination(15)
const auth = useAuthStore()

const products  = ref<Product[] | null>(null)
const categories = ref<Category[]>([])
const tags = ref<Tag[]>([])
const currencies = ref<Currency[]>([])
const search    = ref('')
const categoryId = ref('')
const tagId = ref('')
const currencyCode = ref('')
const offerOnly = ref(false)
const confirm   = reactive({ show: false, id: '', name: '', loading: false })
const tableLoading = computed(() => products.value === null)
const initialized = ref(false)
const defaultCurrencyCode = computed(() => {
  const active = currencies.value.filter((item) => item.isActive)
  return active.find((item) => item.isDefault)?.code ?? getSystemCurrencyCode()
})
const canManageProducts = computed(() => auth.can('products.manage'))

function syncQuery() {
  const query: Record<string, string> = {}
  if (pg.page.value > 1) query.page = String(pg.page.value)
  if (search.value.trim()) query.search = search.value.trim()
  if (categoryId.value) query.categoryId = categoryId.value
  if (tagId.value) query.tagId = tagId.value
  if (currencyCode.value) query.currencyCode = currencyCode.value
  if (offerOnly.value) query.hasOffer = 'true'
  router.replace({ query })
}

async function loadFilters() {
  const [cats, tg, cc] = await Promise.all([categoriesService.list(), tagsService.list(), currenciesService.list()])
  categories.value = cats
  tags.value = tg.filter((item) => item.isActive)
  currencies.value = cc.filter((item) => item.isActive)
}

async function load() {
  products.value = null
  try {
    const data = await productsService.list({
      page: pg.page.value,
      limit: pg.limit.value,
      search: search.value || undefined,
      categoryId: categoryId.value || undefined,
      tagId: tagId.value || undefined,
      currencyCode: currencyCode.value || undefined,
      hasOffer: offerOnly.value || undefined,
    })
    const result = normalizeApiList(data)
    products.value = result.items
    pg.total.value = result.total
  } catch {
    products.value = []
    toast.error('Error', 'No se pudo cargar los productos')
  }
}

watch([pg.page, search, categoryId, tagId, currencyCode, offerOnly], async () => {
  if (!initialized.value) return
  syncQuery()
  await load()
})

onMounted(async () => {
  const page = Number(route.query.page ?? 1)
  pg.page.value = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  search.value = typeof route.query.search === 'string' ? route.query.search : ''
  categoryId.value = typeof route.query.categoryId === 'string' ? route.query.categoryId : ''
  tagId.value = typeof route.query.tagId === 'string' ? route.query.tagId : ''
  currencyCode.value = typeof route.query.currencyCode === 'string' ? route.query.currencyCode : ''
  offerOnly.value = route.query.hasOffer === 'true'
  initialized.value = true
  await loadFilters()
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

function fmt(n: string | number, currencyCode = getSystemCurrencyCode()) {
  return formatMoney(n, currencyCode)
}

function convertBetweenCurrencies(amount: number | string, fromCode: string, toCode: string) {
  const numeric = Number(amount)
  if (!Number.isFinite(numeric)) {
    return 0
  }

  const from = currencies.value.find((currency) => currency.code === fromCode)
  const to = currencies.value.find((currency) => currency.code === toCode)
  const fromRate = Number(from?.exchangeRateToUsd || 1)
  const toRate = Number(to?.exchangeRateToUsd || 1)

  if (!Number.isFinite(fromRate) || fromRate <= 0 || !Number.isFinite(toRate) || toRate <= 0) {
    return Number(numeric.toFixed(2))
  }

  const amountInUsd = numeric / fromRate
  return Number((amountInUsd * toRate).toFixed(2))
}

function fmtDefault(n: string | number, fromCode: string) {
  const converted = convertBetweenCurrencies(n, fromCode, defaultCurrencyCode.value)
  return formatMoney(converted, defaultCurrencyCode.value)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="flex flex-col gap-3">
      <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <input
          v-model="search"
          class="input-base max-w-xs"
          placeholder="Buscar productos…"
        />
        <UiButton
          v-if="canManageProducts"
          @mouseenter="preloadRichEditor()"
          @focus="preloadRichEditor()"
          @click="router.push({ name: 'products-new' })"
        >
          <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo producto
        </UiButton>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <select v-model="categoryId" class="input-base">
          <option value="">Todas las categorias</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>

        <select v-model="tagId" class="input-base">
          <option value="">Todos los tags</option>
          <option v-for="t in tags" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>

        <select v-model="currencyCode" class="input-base">
          <option value="">Todas las monedas</option>
          <option v-for="c in currencies" :key="c.id" :value="c.code">{{ c.code }} ({{ c.symbol }})</option>
        </select>

        <label class="flex items-center gap-2 rounded-xl border border-[--color-surface-200] px-3 py-2 text-sm text-[--color-surface-700]">
          <input v-model="offerOnly" type="checkbox" class="accent-[--color-primary-600]" />
          Solo productos en oferta
        </label>
      </div>
    </div>

    <!-- Tabla -->
    <UiCard :padding="false">
      <UiTable :data="products" :loading="tableLoading" loading-color="primary" loading-text="Cargando productos..." empty-message="No hay productos">
        <template #head>
          <tr>
            <th class="table-th">Producto</th>
            <th class="table-th">Categoría</th>
            <th class="table-th text-center">Moneda</th>
            <th class="table-th text-right">Precio base</th>
            <th class="table-th text-right">Precio default ({{ defaultCurrencyCode }})</th>
            <th class="table-th text-right">Oferta</th>
            <th class="table-th text-center">Variantes</th>
            <th class="table-th text-center">Estado</th>
            <th class="table-th table-actions-th" />
          </tr>
        </template>

        <tr
          v-for="p in products ?? []"
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
                <p class="text-caption font-mono">SKU: {{ p.sku }}</p>
              </div>
            </div>
          </td>
          <td class="table-td text-muted">{{ p.category?.name ?? '—' }}</td>
          <td class="table-td text-center text-xs text-muted">{{ p.currencyCode }}</td>
          <td class="table-td text-right font-medium">{{ fmt(p.basePrice, p.currencyCode) }}</td>
          <td class="table-td text-right">{{ fmtDefault(p.basePrice, p.currencyCode) }}</td>
          <td class="table-td text-right">
            <span v-if="p.hasOffer" class="text-[--color-success-700] font-medium">
              {{ fmt(p.offerPrice || 0, p.currencyCode) }}
            </span>
            <span v-else class="text-muted">—</span>
          </td>
          <td class="table-td text-center">
            <span class="text-muted">{{ p.variants?.length ?? 0 }}</span>
          </td>
          <td class="table-td text-center">
            <UiBadge :color="p.isActive ? 'success' : 'neutral'" dot>
              {{ p.isActive ? 'Activo' : 'Desactivo' }}
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
                v-if="canManageProducts"
                variant="ghost"
                size="sm"
                @mouseenter="preloadRichEditor()"
                @focus="preloadRichEditor()"
                @click="router.push({ name: 'products-edit', params: { id: p.id } })"
              >
                Editar
              </UiButton>
              <UiButton v-if="canManageProducts" variant="danger" size="sm" @click="askDelete(p)">
                Eliminar
              </UiButton>
            </div>
          </td>
        </tr>

        <template #empty-actions>
          <UiButton size="sm" @click="search = ''; categoryId = ''; tagId = ''; currencyCode = ''; offerOnly = false">Limpiar filtros</UiButton>
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
