import type { ApiEnvelope, TemplateDocument, TemplateResponse } from '~/types/template'

function normalizeUploadUrl(value: string, baseURL: string): string {
  if (!value.startsWith('/uploads/')) {
    return value
  }

  return new URL(value, new URL(baseURL).origin).toString()
}

function normalizeTemplateValue<T>(value: T, baseURL: string): T {
  if (typeof value === 'string') {
    return normalizeUploadUrl(value, baseURL) as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeTemplateValue(item, baseURL)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeTemplateValue(entry, baseURL)])
    ) as T
  }

  return value
}

function normalizeTemplateAssetUrls(document: TemplateDocument, baseURL: string): TemplateDocument {
  return normalizeTemplateValue(document, baseURL)
}

/**
 * Returns the base URL to use for API requests.
 * - On the server (SSR): uses the direct backend URL (no CORS).
 * - On the client (browser): uses the Nuxt dev-proxy path to avoid CORS.
 */
function resolveApiBase(configBase: string): string {
  if (import.meta.server) {
    return configBase
  }
  return '/backend-api'
}

export async function fetchPublishedTemplate(
  templateKey: string,
  params?: { version?: number; channel?: 'web' }
): Promise<TemplateDocument> {
  const config = useRuntimeConfig()
  const configBase = config.public.adminApiBase as string
  const baseURL = resolveApiBase(configBase)

  const response = await $fetch<ApiEnvelope<TemplateResponse>>(`/templates/${templateKey}`, {
    baseURL,
    query: {
      channel: params?.channel ?? 'web',
      ...(params?.version ? { version: params.version } : {})
    }
  })

  return normalizeTemplateAssetUrls(response.data.content, configBase)
}

export async function fetchDraftPreviewTemplate(
  draftId: string,
  token: string
): Promise<TemplateDocument> {
  const config = useRuntimeConfig()
  const configBase = config.public.adminApiBase as string
  const baseURL = resolveApiBase(configBase)

  const response = await $fetch<ApiEnvelope<TemplateResponse>>(`/templates/preview/${draftId}`, {
    baseURL,
    query: {
      token,
    },
  })

  return normalizeTemplateAssetUrls(response.data.content, configBase)
}
