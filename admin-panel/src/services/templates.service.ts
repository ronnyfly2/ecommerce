import { http } from './http'
import type { ApiResponse } from '@/types/api'

export type TemplateChannel = 'web'
export type TemplatePageType = 'home' | 'category'
export type TemplateStatus = 'draft' | 'published' | 'deprecated'

export interface TemplateRecord {
  id: string
  templateKey: string
  channel: TemplateChannel
  pageType: TemplatePageType
  version: number
  status: TemplateStatus
  schemaVersion: string
  content: Record<string, unknown>
  publishNote: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export interface QueryAdminTemplates {
  templateKey?: string
  channel?: TemplateChannel
  pageType?: TemplatePageType
  status?: TemplateStatus
  sortBy?: 'createdAt' | 'updatedAt' | 'publishedAt' | 'version'
  sortOrder?: 'ASC' | 'DESC'
}

export interface CreateTemplateInput {
  templateKey: string
  channel: TemplateChannel
  pageType: TemplatePageType
  schemaVersion: string
  content: Record<string, unknown>
}

export interface UpdateTemplateInput {
  schemaVersion?: string
  content?: Record<string, unknown>
}

export interface PreviewTokenResponse {
  templateId: string
  token: string
  expiresIn: string
}

export const templatesService = {
  async list(query?: QueryAdminTemplates): Promise<TemplateRecord[]> {
    const res = await http.get<ApiResponse<TemplateRecord[]>>('/admin/templates', { params: query })
    return res.data.data
  },

  async get(id: string): Promise<TemplateRecord> {
    const res = await http.get<ApiResponse<TemplateRecord>>(`/admin/templates/${id}`)
    return res.data.data
  },

  async getPublished(templateKey: string, params?: { channel?: TemplateChannel; version?: number }): Promise<TemplateRecord> {
    const res = await http.get<ApiResponse<TemplateRecord>>(`/templates/${encodeURIComponent(templateKey)}`, {
      params: {
        channel: params?.channel ?? 'web',
        ...(params?.version ? { version: params.version } : {})
      }
    })
    return res.data.data
  },

  async create(input: CreateTemplateInput): Promise<TemplateRecord> {
    const res = await http.post<ApiResponse<TemplateRecord>>('/admin/templates', input)
    return res.data.data
  },

  async update(id: string, input: UpdateTemplateInput): Promise<TemplateRecord> {
    const res = await http.put<ApiResponse<TemplateRecord>>(`/admin/templates/${id}`, input)
    return res.data.data
  },

  async publish(id: string, publishNote?: string): Promise<TemplateRecord> {
    const res = await http.post<ApiResponse<TemplateRecord>>(`/admin/templates/${id}/publish`, {
      publishNote,
    })
    return res.data.data
  },

  async rollback(id: string, sourceVersion: number): Promise<TemplateRecord> {
    const res = await http.post<ApiResponse<TemplateRecord>>(`/admin/templates/${id}/rollback`, {
      sourceVersion,
    })
    return res.data.data
  },

  async deprecate(id: string): Promise<TemplateRecord> {
    const res = await http.post<ApiResponse<TemplateRecord>>(`/admin/templates/${id}/deprecate`)
    return res.data.data
  },

  async createPreviewToken(id: string): Promise<PreviewTokenResponse> {
    const res = await http.post<ApiResponse<PreviewTokenResponse>>(`/admin/templates/${id}/preview-token`)
    return res.data.data
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/admin/templates/${id}`)
  },
}
