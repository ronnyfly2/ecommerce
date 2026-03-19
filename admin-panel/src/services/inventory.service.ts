import { http } from './http'
import type {
  ApiResponse,
  ApiListData,
  InventoryMovement,
  CreateInventoryAdjustmentDto,
  QueryInventoryMovementsDto,
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
}
