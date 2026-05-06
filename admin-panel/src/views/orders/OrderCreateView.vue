<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ordersService } from '@/services/orders.service'
import { productsService } from '@/services/products.service'
import { inventoryService } from '@/services/inventory.service'
import { normalizeApiList } from '@/utils/api-list'
import { extractErrorMessage } from '@/utils/error'
import { OrderFulfillmentType } from '@/types/api'
import type {
  Product,
  ProductStockOverview,
  Store,
  OrderFulfillmentType as OrderFulfillmentTypeValue,
} from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import FormModalLayout from '@/components/forms/FormModalLayout.vue'
import LeafletAddressPicker from '@/components/maps/LeafletAddressPicker.vue'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const toast = useToast()

const loading = ref(false)
const submitting = ref(false)
const products = ref<Product[]>([])
const stores = ref<Store[]>([])
const stocksByProduct = ref<Map<string, ProductStockOverview>>(new Map())
const stocksAvailable = ref(true)

const form = reactive({
  fulfillmentType: OrderFulfillmentType.DELIVERY as OrderFulfillmentTypeValue,
  pickupStoreId: '',
  notes: '',
  itemProductId: '',
  itemQuantity: 1,
  shippingFirstName: '',
  shippingLastName: '',
  shippingStreet: '',
  shippingCity: '',
  shippingState: '',
  shippingPostalCode: '',
  shippingCountry: 'Peru',
  shippingPhone: '',
  shippingLat: '',
  shippingLng: '',
  shippingFullAddress: '',
})

function applyPickedAddress(displayName: string) {
  if (!displayName) return
  const segments = displayName.split(',').map((s) => s.trim()).filter(Boolean)
  if (segments.length === 0) return

  // Nominatim/Photon usually returns: "Street, Neighborhood, City, State, PostalCode, Country"
  // Fill empty fields only — do not overwrite anything the user already typed.
  const last = segments[segments.length - 1]
  const postalCandidate = segments.find((s) => /^\d{4,6}(-\d+)?$/.test(s))

  if (!form.shippingStreet) form.shippingStreet = segments[0]
  if (!form.shippingCountry && last) form.shippingCountry = last
  if (!form.shippingPostalCode && postalCandidate) form.shippingPostalCode = postalCandidate

  if (!form.shippingCity || !form.shippingState) {
    const middle = segments.slice(1, -1).filter((s) => s !== postalCandidate)
    if (!form.shippingCity && middle.length >= 1) form.shippingCity = middle[middle.length - 1]
    if (!form.shippingState && middle.length >= 2) form.shippingState = middle[middle.length - 2]
  }
}

const fulfillmentOptions = [
  { value: OrderFulfillmentType.DELIVERY, label: 'Delivery / Online' },
  { value: OrderFulfillmentType.PICKUP, label: 'Retiro en tienda' },
]

const productOptions = computed(() => [
  { value: '', label: 'Seleccionar producto' },
  ...products.value.map((product) => ({
    value: product.id,
    label: `${product.name} · ${product.sku}`,
  })),
])

const storeOptions = computed(() => [
  { value: '', label: 'Seleccionar tienda' },
  ...stores.value.map((store) => ({
    value: store.id,
    label: `${store.code} · ${store.name}`,
  })),
])

const requiresShippingAddress = computed(() => form.fulfillmentType === OrderFulfillmentType.DELIVERY)

const selectedProduct = computed(() =>
  products.value.find((p) => p.id === form.itemProductId) ?? null,
)

const selectedProductStock = computed(() => {
  if (!form.itemProductId) return null
  return stocksByProduct.value.get(form.itemProductId) ?? null
})

const availableStock = computed<number | null>(() => {
  if (!stocksAvailable.value) return null
  const stock = selectedProductStock.value
  if (!stock) return null
  if (form.fulfillmentType === OrderFulfillmentType.DELIVERY) {
    return stock.deliveryStock
  }
  if (!form.pickupStoreId) return null
  return stock.pickupStocks.find((p) => p.storeId === form.pickupStoreId)?.stock ?? 0
})

const stockExceeded = computed(() => {
  if (availableStock.value == null) return false
  return Number(form.itemQuantity) > availableStock.value
})

const noStockForChannel = computed(() => availableStock.value === 0)

const canSubmit = computed(() => {
  if (submitting.value || loading.value) return false
  if (!form.itemProductId) return false
  if (Number(form.itemQuantity) < 1) return false
  if (form.fulfillmentType === OrderFulfillmentType.PICKUP && !form.pickupStoreId) return false
  if (stockExceeded.value || noStockForChannel.value) return false
  return true
})

async function load() {
  loading.value = true
  try {
    const [productsData, storesData] = await Promise.all([
      productsService.list({ page: 1, limit: 100 }),
      inventoryService.stores(),
    ])
    products.value = normalizeApiList(productsData).items
    stores.value = storesData
    await loadStocks()
  } catch {
    toast.error('Error', 'No se pudieron cargar productos/tiendas')
  } finally {
    loading.value = false
  }
}

async function loadStocks() {
  const ids = products.value.map((p) => p.id)
  if (ids.length === 0) {
    stocksByProduct.value = new Map()
    return
  }
  try {
    const overviews = await inventoryService.productStocksByProducts({ productIds: ids })
    stocksByProduct.value = new Map(overviews.map((o) => [o.productId, o]))
    stocksAvailable.value = true
  } catch {
    stocksAvailable.value = false
    stocksByProduct.value = new Map()
  }
}

function clampQuantityToStock() {
  if (availableStock.value == null) return
  if (Number(form.itemQuantity) > availableStock.value) {
    form.itemQuantity = Math.max(1, availableStock.value)
  }
}

function validate() {
  if (!form.itemProductId) {
    toast.warning('Producto requerido', 'Selecciona un producto para la orden')
    return false
  }

  if (!Number.isFinite(Number(form.itemQuantity)) || Number(form.itemQuantity) < 1) {
    toast.warning('Cantidad inválida', 'La cantidad debe ser mayor o igual a 1')
    return false
  }

  if (form.fulfillmentType === OrderFulfillmentType.PICKUP && !form.pickupStoreId) {
    toast.warning('Tienda requerida', 'Selecciona una tienda para retiro')
    return false
  }

  if (noStockForChannel.value) {
    toast.warning(
      'Sin stock disponible',
      form.fulfillmentType === OrderFulfillmentType.DELIVERY
        ? 'Este producto no tiene stock para delivery'
        : 'Este producto no tiene stock en la tienda seleccionada',
    )
    return false
  }

  if (stockExceeded.value && availableStock.value != null) {
    toast.warning(
      'Cantidad supera el stock',
      `Solo hay ${availableStock.value} unidad(es) disponibles`,
    )
    return false
  }

  if (requiresShippingAddress.value) {
    const required: Array<[string, string]> = [
      [form.shippingFirstName, 'Nombre'],
      [form.shippingLastName, 'Apellido'],
      [form.shippingStreet, 'Direccion'],
      [form.shippingCity, 'Ciudad'],
      [form.shippingState, 'Estado'],
      [form.shippingPostalCode, 'Codigo postal'],
      [form.shippingCountry, 'Pais'],
    ]
    const missing = required.find(([value]) => !value.trim())
    if (missing) {
      toast.warning('Direccion incompleta', `Falta: ${missing[1]}`)
      return false
    }
  }

  return true
}

async function submit() {
  if (!validate()) return

  submitting.value = true
  try {
    const order = await ordersService.create({
      fulfillmentType: form.fulfillmentType,
      pickupStoreId: form.fulfillmentType === OrderFulfillmentType.PICKUP ? form.pickupStoreId : undefined,
      notes: form.notes.trim() || undefined,
      items: [
        {
          productId: form.itemProductId,
          quantity: Number(form.itemQuantity),
        },
      ],
      shippingAddress: requiresShippingAddress.value
        ? {
          firstName: form.shippingFirstName.trim(),
          lastName: form.shippingLastName.trim(),
          street: form.shippingStreet.trim(),
          city: form.shippingCity.trim(),
          state: form.shippingState.trim(),
          postalCode: form.shippingPostalCode.trim(),
          country: form.shippingCountry.trim(),
          phoneNumber: form.shippingPhone.trim() || undefined,
          lat: form.shippingLat ? Number(form.shippingLat) : undefined,
          lng: form.shippingLng ? Number(form.shippingLng) : undefined,
        }
        : undefined,
    })

    toast.success('Orden creada', 'Se creó correctamente')
    router.push({ name: 'orders-detail', params: { id: order.id } })
  } catch (e) {
    toast.error('Error', extractErrorMessage(e, 'No se pudo crear la orden'))
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-heading-2">Nueva orden</h2>
        <p class="text-muted">Simulador de checkout para delivery/retiro</p>
      </div>
      <UiButton variant="secondary" @click="router.push({ name: 'orders' })">Volver</UiButton>
    </div>

    <UiCard :loading="loading" title="Datos de la orden">
      <FormModalLayout :columns="2">
        <UiSelect
          v-model="form.fulfillmentType"
          label="Fulfillment"
          size="lg"
          :options="fulfillmentOptions"
        />

        <UiSelect
          v-if="form.fulfillmentType === OrderFulfillmentType.PICKUP"
          v-model="form.pickupStoreId"
          label="Tienda de retiro"
          size="lg"
          :options="storeOptions"
        />

        <div class="flex flex-col gap-1">
          <UiSelect
            v-model="form.itemProductId"
            label="Producto"
            searchable
            size="lg"
            search-placeholder="Buscar producto..."
            :options="productOptions"
          />
          <div v-if="selectedProduct" class="flex items-center gap-2 mt-1">
            <UiBadge
              v-if="!stocksAvailable"
              color="neutral"
            >
              Stock no disponible
            </UiBadge>
            <UiBadge
              v-else-if="availableStock == null"
              color="neutral"
            >
              {{ form.fulfillmentType === OrderFulfillmentType.PICKUP
                ? 'Selecciona la tienda para ver el stock'
                : 'Sin informacion de stock' }}
            </UiBadge>
            <UiBadge
              v-else-if="availableStock === 0"
              color="danger"
              dot
            >
              Sin stock para
              {{ form.fulfillmentType === OrderFulfillmentType.PICKUP ? 'esta tienda' : 'delivery' }}
            </UiBadge>
            <UiBadge
              v-else-if="availableStock <= 5"
              color="warning"
              dot
            >
              Stock bajo: {{ availableStock }} unidad{{ availableStock === 1 ? '' : 'es' }}
            </UiBadge>
            <UiBadge v-else color="success" dot>
              {{ availableStock }} unidades disponibles
            </UiBadge>
          </div>
        </div>

        <UiInput
          v-model="form.itemQuantity"
          type="number"
          min="1"
          :max="availableStock ?? undefined"
          label="Cantidad"
          size="lg"
          :error="stockExceeded && availableStock != null
            ? `Maximo disponible: ${availableStock}`
            : undefined"
          @blur="clampQuantityToStock"
        />

        <UiTextarea
          v-model="form.notes"
          :rows="3"
          size="lg"
          label="Notas"
          placeholder="Notas opcionales"
        />
      </FormModalLayout>

      <div v-if="requiresShippingAddress" class="mt-6 space-y-5">
        <div>
          <h3 class="text-sm font-semibold text-surface-800 mb-1">Ubicacion del cliente</h3>
          <p class="text-xs text-muted mb-3">
            Busca la direccion o haz click en el mapa. Las coordenadas se usan para sugerir la
            transportadora mas adecuada al crear el envio.
          </p>
          <LeafletAddressPicker
            v-model:lat="form.shippingLat"
            v-model:lng="form.shippingLng"
            v-model:address="form.shippingFullAddress"
            height-class="h-72"
            @update:address="applyPickedAddress"
          />
        </div>

        <div>
          <h3 class="text-sm font-semibold text-surface-800 mb-3">Datos de la direccion</h3>
          <FormModalLayout :columns="2">
            <UiInput v-model="form.shippingFirstName" label="Nombre" size="lg" required />
            <UiInput v-model="form.shippingLastName" label="Apellido" size="lg" required />
            <UiInput v-model="form.shippingStreet" label="Direccion" size="lg" required />
            <UiInput v-model="form.shippingCity" label="Ciudad" size="lg" required />
            <UiInput v-model="form.shippingState" label="Estado/Provincia" size="lg" required />
            <UiInput v-model="form.shippingPostalCode" label="Codigo postal" size="lg" required />
            <UiInput v-model="form.shippingCountry" label="Pais" size="lg" required />
            <UiInput v-model="form.shippingPhone" label="Telefono" size="lg" />
          </FormModalLayout>
          <p v-if="form.shippingLat && form.shippingLng" class="mt-2 text-xs text-muted font-mono">
            Coordenadas: {{ form.shippingLat }}, {{ form.shippingLng }}
          </p>
        </div>
      </div>

      <div class="mt-6 flex justify-end">
        <UiButton :loading="submitting" :disabled="!canSubmit" @click="submit">
          Crear orden
        </UiButton>
      </div>
    </UiCard>
  </div>
</template>
