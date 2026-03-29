import { http } from './http'
import type {
  ApiResponse,
  ApiListData,
  InventoryMovement,
  CreateInventoryAdjustmentDto,
  QueryInventoryMovementsDto,
  Store,
  CreateStoreDto,
  UpdateStoreDto,
  ProductStockOverview,
  UpsertProductStockDto,
  ProductStockListItem,
  QueryProductStocksDto,
  BulkUpsertProductStocksDto,
} from '@/types/api'

export const inventoryService = {
  async movements(params?: QueryInventoryMovementsDto) {
    const res = await http.get<ApiResponse<ApiListData<InventoryMovement>>>('/inventory/movements', { params })
    return res.data.data
  },

  async adjust(dto: CreateInventoryAdjustmentDto) {
    const res = await http.post<ApiResponse<InventoryMovement>>('/inventory/adjustment', dto)
    return res.data.data
  },

  async stores() {
    const res = await http.get<ApiResponse<Store[]>>('/inventory/stores')
    return res.data.data
  },

  async allStores() {
    const res = await http.get<ApiResponse<Store[]>>('/inventory/stores/all')
    return res.data.data
  },

  async createStore(dto: CreateStoreDto) {
    const res = await http.post<ApiResponse<Store>>('/inventory/stores', dto)
    return res.data.data
  },

  async updateStore(id: string, dto: UpdateStoreDto) {
    const res = await http.patch<ApiResponse<Store>>(`/inventory/stores/${id}`, dto)
    return res.data.data
  },

  async deleteStore(id: string) {
    await http.delete(`/inventory/stores/${id}`)
  },

  async getProductStock(productId: string) {
    const res = await http.get<ApiResponse<ProductStockOverview>>(`/inventory/products/${productId}/stock`)
    return res.data.data
  },

  async upsertProductStock(productId: string, dto: UpsertProductStockDto) {
    const res = await http.put<ApiResponse<ProductStockOverview>>(`/inventory/products/${productId}/stock`, dto)
    return res.data.data
  },

  async productStocks(params?: QueryProductStocksDto) {
    const res = await http.get<ApiResponse<ApiListData<ProductStockListItem>>>('/inventory/stocks', { params })
    return res.data.data
  },

  async bulkUpsertProductStocks(dto: BulkUpsertProductStocksDto) {
    const res = await http.put<ApiResponse<{ totalUpdated: number; items: ProductStockOverview[] }>>('/inventory/stocks/bulk', dto)
    return res.data.data
  },
}
