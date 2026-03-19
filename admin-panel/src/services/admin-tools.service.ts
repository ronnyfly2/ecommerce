import { http } from './http'
import type { ApiResponse, SeedCleanMode } from '@/types/api'

export interface SeedActionResult {
  [key: string]: unknown
}

export const adminToolsService = {
  async runSeed() {
    const res = await http.post<ApiResponse<SeedActionResult>>('/admin-tools/seed/run', {})
    return res.data.data
  },

  async cleanSeed(mode: SeedCleanMode, force = false, confirmationPhrase?: string) {
    const res = await http.post<ApiResponse<SeedActionResult>>('/admin-tools/seed/clean', {
      mode,
      force,
      confirmationPhrase,
    }, {
      headers: confirmationPhrase
        ? { 'x-seed-confirmation': confirmationPhrase }
        : undefined,
    })
    return res.data.data
  },
}
