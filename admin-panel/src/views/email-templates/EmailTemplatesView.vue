<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import ListViewToolbar from '@/components/shared/ListViewToolbar.vue'
import EmailTemplateEditor from './EmailTemplateEditor.vue'
import {
  emailTemplatesService,
  type EmailTemplateSummary,
  type EmailTemplateCategory,
} from '@/services/email-templates.service'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/utils/error'

const toast = useToast()

const templates = ref<EmailTemplateSummary[]>([])
const loading = ref(false)
const selectedKey = ref<string | null>(null)
const searchQuery = ref('')

const CATEGORY_LABELS: Record<EmailTemplateCategory, string> = {
  order: 'Orden',
  payment: 'Pago',
  shipment: 'Envio',
  return: 'Devolucion',
  stock: 'Stock',
  auth: 'Cuenta',
}

const grouped = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const filtered = q
    ? templates.value.filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.key.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      )
    : templates.value
  const buckets = new Map<EmailTemplateCategory, EmailTemplateSummary[]>()
  for (const t of filtered) {
    if (!buckets.has(t.category)) buckets.set(t.category, [])
    buckets.get(t.category)!.push(t)
  }
  return Array.from(buckets.entries()).map(([category, items]) => ({
    category,
    label: CATEGORY_LABELS[category] ?? category,
    items,
  }))
})

async function loadTemplates() {
  loading.value = true
  try {
    templates.value = await emailTemplatesService.list()
    if (!selectedKey.value && templates.value.length > 0) {
      selectedKey.value = templates.value[0].key
    }
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudieron cargar las plantillas'))
  } finally {
    loading.value = false
  }
}

function handleSavedOrReset(updated: EmailTemplateSummary) {
  const idx = templates.value.findIndex((t) => t.key === updated.key)
  if (idx >= 0) templates.value[idx] = { ...templates.value[idx], ...updated }
}

onMounted(loadTemplates)
</script>

<template>
  <div class="space-y-4">
    <ListViewToolbar>
      <template #default>
        <div class="flex items-center gap-2">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Buscar plantilla..."
            class="input-base input-sm w-64"
          />
        </div>
      </template>
    </ListViewToolbar>

    <div class="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      <UiCard :padding="false">
        <div v-if="loading" class="p-8 flex items-center justify-center">
          <UiSpinner />
        </div>
        <div v-else-if="templates.length === 0" class="p-6 text-center text-muted text-sm">
          No hay plantillas configuradas.
        </div>
        <div v-else class="divide-y divide-surface-200 max-h-[72vh] overflow-y-auto">
          <div v-for="group in grouped" :key="group.category">
            <div class="px-4 py-2 bg-surface-50 border-b border-surface-200">
              <p class="text-caption uppercase tracking-wider">{{ group.label }}</p>
            </div>
            <button
              v-for="tpl in group.items"
              :key="tpl.key"
              type="button"
              :class="[
                'w-full text-left px-4 py-3 hover:bg-surface-50 transition-colors',
                selectedKey === tpl.key ? 'bg-primary-50 border-l-2 border-primary-600' : '',
              ]"
              @click="selectedKey = tpl.key"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-surface-900 truncate">{{ tpl.label }}</p>
                  <p class="text-xs text-muted truncate mt-0.5">{{ tpl.key }}</p>
                </div>
                <div class="flex flex-col items-end gap-1 shrink-0">
                  <UiBadge v-if="tpl.isCustomized" color="info">Editada</UiBadge>
                  <UiBadge v-if="!tpl.isEnabled" color="neutral">Desactivada</UiBadge>
                </div>
              </div>
            </button>
          </div>
        </div>
      </UiCard>

      <EmailTemplateEditor
        v-if="selectedKey"
        :key="selectedKey"
        :template-key="selectedKey"
        @updated="handleSavedOrReset"
      />
      <UiCard v-else>
        <div class="p-10 text-center text-muted text-sm">Selecciona una plantilla para editarla.</div>
      </UiCard>
    </div>
  </div>
</template>
