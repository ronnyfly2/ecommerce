<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '@/services/auth.service'
import { extractErrorMessage } from '@/utils/error'
import UiToastContainer from '@/components/ui/UiToastContainer.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'

const router = useRouter()

const form = reactive({ email: '' })
const loading = ref(false)
const successMessage = ref('')
const error = ref('')

async function submit() {
  loading.value = true
  error.value = ''
  successMessage.value = ''

  try {
    const response = await authService.forgotPassword({ email: form.email })
    successMessage.value = response.message
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos procesar la solicitud')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-[--color-surface-100] flex items-center justify-center p-4">
    <UiToastContainer />

    <div class="w-full max-w-md card p-6 space-y-4">
      <div>
        <h1 class="text-heading-2">Recuperar contraseña</h1>
        <p class="text-muted mt-1">
          Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <UiInput
          id="forgot-email"
          v-model="form.email"
          type="email"
          label="Email"
          autocomplete="email"
          placeholder="admin@tienda.com"
          required
        />

        <div v-if="successMessage" class="text-sm text-[--color-success-700] bg-[--color-success-50] rounded-lg px-3 py-2">
          {{ successMessage }}
        </div>

        <div v-if="error" class="text-sm text-[--color-danger-600] bg-[--color-danger-50] rounded-lg px-3 py-2">
          {{ error }}
        </div>

        <UiButton type="submit" size="lg" class="w-full" :loading="loading">
          {{ loading ? 'Enviando…' : 'Enviar enlace' }}
        </UiButton>
      </form>

      <div class="flex justify-between items-center pt-2 border-t border-[--color-surface-200]">
        <button
          type="button"
          class="text-sm text-[--color-primary-700] hover:text-[--color-primary-800]"
          @click="router.push({ name: 'login' })"
        >
          Volver al login
        </button>
      </div>
    </div>
  </div>
</template>
