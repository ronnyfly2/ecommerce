import { http } from './http'
import type { ApiResponse } from '@/types/api'

export type EmailTemplateCategory =
  | 'order'
  | 'payment'
  | 'shipment'
  | 'return'
  | 'stock'
  | 'auth'

export interface EmailTemplateVariable {
  name: string
  description: string
}

export interface EmailTemplateSummary {
  key: string
  label: string
  description: string
  category: EmailTemplateCategory
  variables: EmailTemplateVariable[]
  defaultSubject: string
  isCustomized: boolean
  isEnabled: boolean
  subject: string
  updatedAt: string | null
}

export interface EmailTemplateDetail extends EmailTemplateSummary {
  sampleContext: Record<string, unknown>
  defaultHtml: string
  html: string
}

export interface EmailTemplateRendered {
  subject: string
  html: string
  text: string
}

export interface UpdateEmailTemplateInput {
  subject: string
  html: string
  isEnabled?: boolean
}

export interface PreviewEmailTemplateInput {
  subject?: string
  html?: string
  context?: Record<string, unknown>
}

export interface TestSendEmailTemplateInput extends PreviewEmailTemplateInput {
  to: string
}

export const emailTemplatesService = {
  async list(): Promise<EmailTemplateSummary[]> {
    const res = await http.get<ApiResponse<EmailTemplateSummary[]>>('/email-templates')
    return res.data.data
  },

  async get(key: string): Promise<EmailTemplateDetail> {
    const res = await http.get<ApiResponse<EmailTemplateDetail>>(`/email-templates/${encodeURIComponent(key)}`)
    return res.data.data
  },

  async update(key: string, input: UpdateEmailTemplateInput): Promise<EmailTemplateDetail> {
    const res = await http.put<ApiResponse<EmailTemplateDetail>>(`/email-templates/${encodeURIComponent(key)}`, input)
    return res.data.data
  },

  async reset(key: string): Promise<EmailTemplateDetail> {
    const res = await http.post<ApiResponse<EmailTemplateDetail>>(`/email-templates/${encodeURIComponent(key)}/reset`)
    return res.data.data
  },

  async preview(key: string, input: PreviewEmailTemplateInput): Promise<EmailTemplateRendered> {
    const res = await http.post<ApiResponse<EmailTemplateRendered>>(`/email-templates/${encodeURIComponent(key)}/preview`, input)
    return res.data.data
  },

  async testSend(key: string, input: TestSendEmailTemplateInput): Promise<{ ok: boolean; subject: string }> {
    const res = await http.post<ApiResponse<{ ok: boolean; subject: string }>>(`/email-templates/${encodeURIComponent(key)}/test-send`, input)
    return res.data.data
  },
}
