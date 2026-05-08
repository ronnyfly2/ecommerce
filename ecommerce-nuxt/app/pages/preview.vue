<script setup lang="ts">
import { fetchDraftPreviewTemplate } from '~/services/template.service'
import { validateTemplateDocument, isSchemaVersionSupported } from '~/utils/template-validation'

const route = useRoute()

const templateKey = computed(() => {
  const value = route.query.templateKey
  if (typeof value === 'string' && value.length > 0) {
    return value
  }
  return 'home.main'
})

const version = computed<number | undefined>(() => {
  const raw = route.query.version
  if (typeof raw !== 'string') {
    return undefined
  }

  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined
  }

  return parsed
})

const draftId = computed(() => {
  const value = route.query.draftId
  return typeof value === 'string' && value.length > 0 ? value : null
})

const token = computed(() => {
  const value = route.query.token
  return typeof value === 'string' && value.length > 0 ? value : null
})

const publishedState = useTemplate(templateKey.value, {
  channel: 'web',
  version: version.value,
})

const draftState = useAsyncData(
  `draft-preview:${draftId.value ?? 'none'}`,
  async () => {
    if (!draftId.value || !token.value) {
      return null
    }

    const document = await fetchDraftPreviewTemplate(draftId.value, token.value)
    if (!validateTemplateDocument(document)) {
      throw new Error('Draft preview document is invalid')
    }
    if (!isSchemaVersionSupported(document.meta.schemaVersion)) {
      throw new Error(`Unsupported schema version: ${document.meta.schemaVersion}`)
    }

    return document
  }
)

const template = computed(() => draftState.data.value ?? publishedState.template.value)
const usingFallback = computed(() =>
  draftId.value ? Boolean(draftState.error.value) : publishedState.usingFallback.value
)
const templateError = computed(() => {
  if (draftState.error.value) {
    return draftState.error.value instanceof Error
      ? draftState.error.value.message
      : 'No se pudo cargar preview de draft'
  }
  return publishedState.templateError.value
})

const modeLabel = computed(() => (draftId.value ? 'draft' : 'published'))
</script>

<template>
  <div>
    <UContainer class="pt-6 space-y-3">
      <UBadge color="primary" variant="soft">
        Preview remoto
      </UBadge>
      <div class="text-sm text-muted">
        templateKey: <strong>{{ templateKey }}</strong>
        <span class="mx-2">|</span>
        version: <strong>{{ version ?? 'latest' }}</strong>
        <span class="mx-2">|</span>
        modo: <strong>{{ modeLabel }}</strong>
      </div>

      <UAlert
        v-if="usingFallback"
        color="warning"
        title="Modo fallback activo"
        description="No se pudo cargar template remoto, se uso fallback local."
      />
      <UAlert
        v-if="templateError"
        color="error"
        title="Error de template"
        :description="templateError"
      />
    </UContainer>

    <TemplateRenderer :template="template" />
  </div>
</template>
