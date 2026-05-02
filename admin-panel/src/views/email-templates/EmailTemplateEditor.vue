<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiModal from '@/components/ui/UiModal.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'
import {
  emailTemplatesService,
  type EmailTemplateDetail,
  type EmailTemplateSummary,
} from '@/services/email-templates.service'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/utils/error'

const props = defineProps<{ templateKey: string }>()
const emit = defineEmits<{ (e: 'updated', value: EmailTemplateSummary): void }>()

const toast = useToast()

const detail = ref<EmailTemplateDetail | null>(null)
const loading = ref(false)
const saving = ref(false)
const resetting = ref(false)
const previewing = ref(false)

const form = ref({ subject: '', html: '', isEnabled: true })
const contextJson = ref('{}')
const contextError = ref<string | null>(null)
const preview = ref<{ subject: string; html: string; text: string } | null>(null)

const showResetConfirm = ref(false)
const showTestModal = ref(false)
const testEmail = ref('')
const testSending = ref(false)

const activeTab = ref<'html' | 'preview' | 'variables'>('html')

const isDirty = computed(() => {
  if (!detail.value) return false
  return (
    form.value.subject !== detail.value.subject ||
    form.value.html !== detail.value.html ||
    form.value.isEnabled !== detail.value.isEnabled
  )
})

watch(() => props.templateKey, load, { immediate: true })

async function load() {
  loading.value = true
  preview.value = null
  try {
    const data = await emailTemplatesService.get(props.templateKey)
    detail.value = data
    form.value = {
      subject: data.subject,
      html: data.html,
      isEnabled: data.isEnabled,
    }
    contextJson.value = JSON.stringify(data.sampleContext, null, 2)
    contextError.value = null
    await renderPreview()
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo cargar la plantilla'))
  } finally {
    loading.value = false
  }
}

function parseContext(): Record<string, unknown> | null {
  const raw = contextJson.value.trim()
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      contextError.value = null
      return parsed as Record<string, unknown>
    }
    contextError.value = 'El contexto debe ser un objeto JSON'
    return null
  } catch (error) {
    contextError.value = `JSON invalido: ${(error as Error).message}`
    return null
  }
}

async function renderPreview() {
  if (!detail.value) return
  const ctx = parseContext()
  if (!ctx) return
  previewing.value = true
  try {
    preview.value = await emailTemplatesService.preview(props.templateKey, {
      subject: form.value.subject,
      html: form.value.html,
      context: ctx,
    })
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo renderizar la preview'))
  } finally {
    previewing.value = false
  }
}

async function save() {
  const ctx = parseContext()
  if (!ctx) return
  saving.value = true
  try {
    const updated = await emailTemplatesService.update(props.templateKey, {
      subject: form.value.subject,
      html: form.value.html,
      isEnabled: form.value.isEnabled,
    })
    detail.value = updated
    emit('updated', updated)
    toast.success('Guardado', 'La plantilla fue actualizada')
    await renderPreview()
  } catch (error) {
    toast.error('Error al guardar', extractErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function confirmReset() {
  resetting.value = true
  try {
    const updated = await emailTemplatesService.reset(props.templateKey)
    detail.value = updated
    form.value = {
      subject: updated.subject,
      html: updated.html,
      isEnabled: updated.isEnabled,
    }
    emit('updated', updated)
    toast.success('Restaurada', 'La plantilla volvio a su version por defecto')
    await renderPreview()
  } catch (error) {
    toast.error('Error', extractErrorMessage(error))
  } finally {
    resetting.value = false
    showResetConfirm.value = false
  }
}

async function sendTest() {
  if (!testEmail.value) return
  const ctx = parseContext()
  if (!ctx) return
  testSending.value = true
  try {
    await emailTemplatesService.testSend(props.templateKey, {
      to: testEmail.value,
      subject: form.value.subject,
      html: form.value.html,
      context: ctx,
    })
    toast.success('Enviado', `Email de prueba enviado a ${testEmail.value}`)
    showTestModal.value = false
  } catch (error) {
    toast.error('Error al enviar', extractErrorMessage(error))
  } finally {
    testSending.value = false
  }
}
</script>

<template>
  <UiCard :padding="false">
    <div v-if="loading || !detail" class="p-10 flex items-center justify-center">
      <UiSpinner />
    </div>
    <div v-else class="flex flex-col">
      <div class="p-4 border-b border-surface-200 flex flex-wrap items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-lg font-semibold text-surface-900">{{ detail.label }}</h2>
            <UiBadge v-if="detail.isCustomized" color="info">Editada</UiBadge>
            <UiBadge v-if="!form.isEnabled" color="neutral">Desactivada</UiBadge>
          </div>
          <p class="text-sm text-muted mt-1">{{ detail.description }}</p>
          <p class="text-xs text-muted mt-1 font-mono">{{ detail.key }}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <UiButton variant="ghost" :disabled="saving" @click="showTestModal = true">
            Enviar de prueba
          </UiButton>
          <UiButton
            v-if="detail.isCustomized"
            variant="ghost"
            :disabled="saving || resetting"
            @click="showResetConfirm = true"
          >
            Restaurar
          </UiButton>
          <UiButton :loading="saving" :disabled="!isDirty" @click="save">
            Guardar cambios
          </UiButton>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-0 divide-y xl:divide-y-0 xl:divide-x divide-surface-200">
        <!-- Edit pane -->
        <div class="p-4 space-y-4">
          <UiInput
            v-model="form.subject"
            label="Asunto"
            placeholder="Asunto del email (soporta variables)"
          />

          <FormToggleField v-model="form.isEnabled" label="Plantilla activa" />

          <div class="border-b border-surface-200 -mx-4">
            <nav class="flex px-4 gap-4">
              <button
                v-for="tab in [
                  { id: 'html', label: 'HTML' },
                  { id: 'variables', label: 'Variables' },
                  { id: 'preview', label: 'Contexto de prueba' },
                ]"
                :key="tab.id"
                type="button"
                :class="[
                  'py-2 text-sm border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-700 font-medium'
                    : 'border-transparent text-muted hover:text-surface-800',
                ]"
                @click="activeTab = tab.id as typeof activeTab"
              >
                {{ tab.label }}
              </button>
            </nav>
          </div>

          <div v-show="activeTab === 'html'">
            <UiTextarea
              v-model="form.html"
              label="Cuerpo HTML (Handlebars)"
              :rows="20"
              class="font-mono text-xs"
            />
            <p class="text-xs text-muted mt-1">
              <span v-pre>Usa <code class="text-primary-700">{{variable}}</code> para sustituir valores y helpers como <code class="text-primary-700">{{formatCurrency amount currency}}</code>.</span>
            </p>
          </div>

          <div v-show="activeTab === 'variables'">
            <p class="text-sm font-medium text-surface-800 mb-2">Variables disponibles</p>
            <ul class="text-sm divide-y divide-surface-100 border border-surface-200 rounded-md overflow-hidden">
              <li
                v-for="v in detail.variables"
                :key="v.name"
                class="flex items-start gap-3 px-3 py-2"
              >
                <code class="text-xs text-primary-700 bg-primary-50 px-2 py-0.5 rounded shrink-0">{{ v.name }}</code>
                <span class="text-muted">{{ v.description }}</span>
              </li>
            </ul>
            <p class="text-xs text-muted mt-3">Ademas: <code>appUrl</code>, <code>appName</code>, <code>currentYear</code>.</p>
          </div>

          <div v-show="activeTab === 'preview'">
            <label class="text-sm font-medium text-surface-800 block mb-1">
              Contexto JSON de prueba
            </label>
            <textarea
              v-model="contextJson"
              rows="14"
              class="w-full border border-surface-300 rounded-md px-3 py-2 font-mono text-xs"
              @blur="renderPreview"
            />
            <p v-if="contextError" class="text-xs text-danger-600 mt-1">{{ contextError }}</p>
            <div class="mt-2">
              <UiButton variant="ghost" size="sm" :loading="previewing" @click="renderPreview">
                Actualizar preview
              </UiButton>
            </div>
          </div>
        </div>

        <!-- Preview pane -->
        <div class="p-4 space-y-3 bg-surface-50">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium text-surface-800">Preview</p>
            <UiSpinner v-if="previewing" />
          </div>
          <div v-if="preview" class="bg-white border border-surface-200 rounded-md overflow-hidden">
            <div class="px-3 py-2 border-b border-surface-200 bg-surface-50">
              <p class="text-xs text-muted">Asunto</p>
              <p class="text-sm font-medium text-surface-900">{{ preview.subject }}</p>
            </div>
            <iframe
              :srcdoc="preview.html"
              class="w-full h-140 bg-white"
              sandbox="allow-same-origin"
              title="Preview del email"
            />
          </div>
          <div v-else class="text-sm text-muted text-center py-10">
            Sin preview disponible.
          </div>
        </div>
      </div>
    </div>

    <UiConfirm
      :show="showResetConfirm"
      title="Restaurar plantilla"
      :message="'Se eliminaran tus personalizaciones y la plantilla volvera a su version por defecto. Esta accion no se puede deshacer.'"
      confirm-label="Restaurar"
      variant="danger"
      :loading="resetting"
      @confirm="confirmReset"
      @cancel="showResetConfirm = false"
    />

    <UiModal :show="showTestModal" title="Enviar email de prueba" @close="showTestModal = false">
      <div class="space-y-3">
        <UiInput
          v-model="testEmail"
          type="email"
          label="Enviar a"
          placeholder="tucorreo@ejemplo.com"
          required
        />
        <p class="text-xs text-muted">
          Se enviara esta plantilla con el contexto de prueba actual. Asegurate de que
          <code>MAIL_PROVIDER</code> este configurado.
        </p>
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="showTestModal = false">Cancelar</UiButton>
        <UiButton :loading="testSending" :disabled="!testEmail" @click="sendTest">Enviar</UiButton>
      </template>
    </UiModal>
  </UiCard>
</template>
