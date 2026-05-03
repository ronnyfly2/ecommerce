import { http } from './http'
import type { ApiResponse, SeedCleanMode, SeedRunTarget } from '@/types/api'

export interface SeedActionResult {
  [key: string]: unknown
}

export const adminToolsService = {
  async runSeed(targets?: SeedRunTarget[]) {
    const res = await http.post<ApiResponse<SeedActionResult>>('/admin-tools/seed/run', {
      targets,
    })
    return res.data.data
  },

  async cleanSeed(mode: SeedCleanMode, force = false, confirmationPhrase?: string, targets?: SeedRunTarget[]) {
    const res = await http.post<ApiResponse<SeedActionResult>>('/admin-tools/seed/clean', {
      mode,
      force,
      confirmationPhrase,
      targets,
    }, {
      headers: confirmationPhrase
        ? { 'x-seed-confirmation': confirmationPhrase }
        : undefined,
    })
    return res.data.data
  },
}
