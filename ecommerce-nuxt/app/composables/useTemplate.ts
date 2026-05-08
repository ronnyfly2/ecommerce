import { computed } from 'vue'
import { categoryDefaultFallbackTemplate } from '~/templates/fallbacks/category-default'
import { homeMinimalFallbackTemplate } from '~/templates/fallbacks/home-minimal'
import { homeMainFallbackTemplate } from '~/templates/fallbacks/home-main'
import type { TemplateDocument } from '~/types/template'
import { fetchPublishedTemplate } from '~/services/template.service'
import { isSchemaVersionSupported, validateTemplateDocument } from '~/utils/template-validation'

interface TemplateLoadResult {
  document: TemplateDocument
  usedFallback: boolean
  errorMessage: string | null
}

function resolveFallback(templateKey: string): TemplateDocument {
  if (templateKey === 'category.default') {
    return categoryDefaultFallbackTemplate
  }

  if (templateKey === 'home.minimal') {
    return homeMinimalFallbackTemplate
  }

  return homeMainFallbackTemplate
}

export function useTemplate(templateKey: string, options?: { version?: number; channel?: 'web' }) {
  const fallback = resolveFallback(templateKey)

  const state = useAsyncData<TemplateLoadResult>(
    `template:${templateKey}:${options?.version ?? 'latest'}`,
    async () => {
      try {
        const document = await fetchPublishedTemplate(templateKey, options)

        if (!validateTemplateDocument(document)) {
          return {
            document: fallback,
            usedFallback: true,
            errorMessage: 'Template document is invalid'
          }
        }

        if (!isSchemaVersionSupported(document.meta.schemaVersion)) {
          return {
            document: fallback,
            usedFallback: true,
            errorMessage: `Unsupported schema version: ${document.meta.schemaVersion}`
          }
        }

        return {
          document,
          usedFallback: false,
          errorMessage: null
        }
      } catch (error) {
        return {
          document: fallback,
          usedFallback: true,
          errorMessage: error instanceof Error ? error.message : 'Unknown template error'
        }
      }
    }
  )

  const template = computed(() => state.data.value?.document ?? fallback)
  const usingFallback = computed(() => state.data.value?.usedFallback ?? true)
  const templateError = computed(() => state.data.value?.errorMessage ?? null)

  return {
    ...state,
    template,
    usingFallback,
    templateError,
    fallback
  }
}
