import { reactive, ref, computed, type ComputedRef } from 'vue'
import { inventoryService } from '@/services/inventory.service'
import { useToast } from '@/composables/useToast'
import type { ProductStockOverview, UpsertProductStockDto } from '@/types/api'

type StockDraft = {
  deliveryStock: number
  pickupStocks: Record<string, number>
}

export function useProductStock(productId: ComputedRef<string>) {
  const toast = useToast()

  const savingStock = ref(false)
  const productStock = ref<ProductStockOverview | null>(null)
  const stockDraft = reactive<StockDraft>({ deliveryStock: 0, pickupStocks: {} })
  const stockOriginal = reactive<StockDraft>({ deliveryStock: 0, pickupStocks: {} })

  const stockDirty = computed(() => {
    if (!productStock.value) return false
    if (stockDraft.deliveryStock !== stockOriginal.deliveryStock) return true

    return productStock.value.pickupStocks.some(
      (store) => stockDraft.pickupStocks[store.storeId] !== stockOriginal.pickupStocks[store.storeId],
    )
  })

  const stockTotal = computed(() => {
    if (!productStock.value) return 0

    const pickupSum = productStock.value.pickupStocks.reduce(
      (acc, store) => acc + Number(stockDraft.pickupStocks[store.storeId] ?? 0),
      0,
    )

    return Number(stockDraft.deliveryStock) + pickupSum
  })

  async function loadProductStock() {
    try {
      const stock = await inventoryService.getProductStock(productId.value)
      productStock.value = stock
      stockDraft.deliveryStock = stock.deliveryStock
      stockOriginal.deliveryStock = stock.deliveryStock

      stock.pickupStocks.forEach((store) => {
        stockDraft.pickupStocks[store.storeId] = store.stock
        stockOriginal.pickupStocks[store.storeId] = store.stock
      })
    } catch {
      // Ignore if there is no stock record yet.
    }
  }

  async function saveProductStock() {
    if (!productStock.value) return

    savingStock.value = true
    try {
      const dto: UpsertProductStockDto = {
        deliveryStock: Number(stockDraft.deliveryStock),
        pickupStocks: productStock.value.pickupStocks.map((store) => ({
          storeId: store.storeId,
          stock: Number(stockDraft.pickupStocks[store.storeId] ?? 0),
        })),
      }

      await inventoryService.upsertProductStock(productId.value, dto)

      stockOriginal.deliveryStock = Number(stockDraft.deliveryStock)
      productStock.value.pickupStocks.forEach((store) => {
        stockOriginal.pickupStocks[store.storeId] = Number(stockDraft.pickupStocks[store.storeId] ?? 0)
      })

      toast.success('Stock actualizado', 'El stock del producto fue guardado')
    } catch {
      toast.error('Error', 'No se pudo actualizar el stock')
    } finally {
      savingStock.value = false
    }
  }

  return {
    savingStock,
    productStock,
    stockDraft,
    stockOriginal,
    stockDirty,
    stockTotal,
    loadProductStock,
    saveProductStock,
  }
}
