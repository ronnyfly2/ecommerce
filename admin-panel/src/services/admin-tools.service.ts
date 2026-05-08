import { http } from './http'
import type { ApiResponse, SeedCleanMode, SeedRunTarget } from '@/types/api'

export interface SeedActionResult {
  [key: string]: unknown
}

export interface SavePdfDraftPayload {
  documentKey: string
  fileName: string
  totalPages: number
  draft: Record<string, unknown>
}

export interface PdfDraftRecord {
  id: string
  documentKey: string
  fileName: string
  totalPages: number
  draft: Record<string, unknown>
  createdAt: string
  updatedAt: string
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

  async savePdfDraft(payload: SavePdfDraftPayload) {
    const res = await http.put<ApiResponse<PdfDraftRecord>>('/admin-tools/pdf-drafts', payload)
    return res.data.data
  },

  async getPdfDraft(documentKey: string) {
    const res = await http.get<ApiResponse<PdfDraftRecord | null>>('/admin-tools/pdf-drafts', { params: { key: documentKey } })
    return res.data.data ?? null
  },

  async deletePdfDraft(documentKey: string) {
    const res = await http.delete<ApiResponse<{ deleted: boolean }>>('/admin-tools/pdf-drafts', { params: { key: documentKey } })
    return res.data.data
  },
}
