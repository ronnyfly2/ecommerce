<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ordersService } from '@/services/orders.service'
import { productsService } from '@/services/products.service'
import { inventoryService } from '@/services/inventory.service'
import { normalizeApiList } from '@/utils/api-list'
import { extractErrorMessage } from '@/utils/error'
import { OrderFulfillmentType } from '@/types/api'
import type { Product, Store, OrderFulfillmentType as OrderFulfillmentTypeValue } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import FormModalLayout from '@/components/forms/FormModalLayout.vue'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const toast = useToast()

const loading = ref(false)
const submitting = ref(false)
const products = ref<Product[]>([])
const stores = ref<Store[]>([])

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
})

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

async function load() {
  loading.value = true
  try {
    const [productsData, storesData] = await Promise.all([
      productsService.list({ page: 1, limit: 100 }),
      inventoryService.stores(),
    ])
    products.value = normalizeApiList(productsData).items
    stores.value = storesData
  } catch {
    toast.error('Error', 'No se pudieron cargar productos/tiendas')
  } finally {
    loading.value = false
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
          firstName: form.shippingFirstName || 'Cliente',
          lastName: form.shippingLastName || 'Ecommerce',
          street: form.shippingStreet || 'Sin dirección detallada',
          city: form.shippingCity || 'Lima',
          state: form.shippingState || 'Lima',
          postalCode: form.shippingPostalCode || '00000',
          country: form.shippingCountry || 'Peru',
          phoneNumber: form.shippingPhone || undefined,
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

        <UiSelect
          v-model="form.itemProductId"
          label="Producto"
          searchable
          size="lg"
          search-placeholder="Buscar producto..."
          :options="productOptions"
        />

        <UiInput
          v-model="form.itemQuantity"
          type="number"
          min="1"
          label="Cantidad"
          size="lg"
        />

        <UiTextarea
          v-model="form.notes"
          :rows="3"
          size="lg"
          label="Notas"
          placeholder="Notas opcionales"
        />
      </FormModalLayout>

      <div v-if="requiresShippingAddress" class="mt-4">
        <h3 class="text-sm font-semibold text-surface-800 mb-3">Dirección de envío (delivery)</h3>
        <FormModalLayout :columns="2">
          <UiInput v-model="form.shippingFirstName" label="Nombre" size="lg" />
          <UiInput v-model="form.shippingLastName" label="Apellido" size="lg" />
          <UiInput v-model="form.shippingStreet" label="Dirección" size="lg" />
          <UiInput v-model="form.shippingCity" label="Ciudad" size="lg" />
          <UiInput v-model="form.shippingState" label="Estado" size="lg" />
          <UiInput v-model="form.shippingPostalCode" label="Código postal" size="lg" />
          <UiInput v-model="form.shippingCountry" label="País" size="lg" />
          <UiInput v-model="form.shippingPhone" label="Teléfono" size="lg" />
        </FormModalLayout>
      </div>

      <div class="mt-6 flex justify-end">
        <UiButton :loading="submitting" @click="submit">Crear orden</UiButton>
      </div>
    </UiCard>
  </div>
</template>
