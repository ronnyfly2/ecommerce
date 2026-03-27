<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authService } from '@/services/auth.service'
import { extractErrorMessage } from '@/utils/error'
import UiToastContainer from '@/components/ui/UiToastContainer.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'

const route = useRoute()
const router = useRouter()

const token = computed(() => String(route.query.token ?? ''))

const form = reactive({
  password: '',
  confirmPassword: '',
})

const loading = ref(false)
const successMessage = ref('')
const error = ref('')

const tokenMissing = computed(() => token.value.trim().length === 0)
const passwordMismatch = computed(() => form.password !== form.confirmPassword)

async function submit() {
  if (tokenMissing.value) {
    error.value = 'El link de recuperación no contiene un token válido'
    return
  }

  if (passwordMismatch.value) {
    error.value = 'Las contraseñas no coinciden'
    return
  }

  loading.value = true
  error.value = ''
  successMessage.value = ''

  try {
    const response = await authService.resetPassword({
      token: token.value,
      password: form.password,
    })
    successMessage.value = response.message
  } catch (e) {
    error.value = extractErrorMessage(e, 'No se pudo cambiar la contraseña')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-surface-100 flex items-center justify-center p-4">
    <UiToastContainer />

    <div class="w-full max-w-md card p-6 space-y-4">
      <div>
        <h1 class="text-heading-2">Nueva contraseña</h1>
        <p class="text-muted mt-1">
          Crea una contraseña segura para tu cuenta.
        </p>
      </div>

      <div v-if="tokenMissing" class="text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2" role="alert" aria-live="assertive">
        El token es inválido o no fue enviado. Solicita un nuevo enlace de recuperación.
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <UiInput
          id="reset-password"
          v-model="form.password"
          type="password"
          autocomplete="new-password"
          label="Nueva contraseña"
          size="lg"
          placeholder="Mínimo 8 caracteres, mayúscula, número y símbolo"
          required
          :disabled="tokenMissing"
        />

        <UiInput
          id="reset-password-confirm"
          v-model="form.confirmPassword"
          type="password"
          autocomplete="new-password"
          label="Confirmar contraseña"
          size="lg"
          placeholder="Repite tu contraseña"
          required
          :disabled="tokenMissing"
          :error="passwordMismatch ? 'Las contraseñas no coinciden' : undefined"
        />

        <div v-if="successMessage" class="text-sm text-success-700 bg-success-50 rounded-lg px-3 py-2" role="status" aria-live="polite">
          {{ successMessage }}
        </div>

        <div v-if="error" class="text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2" role="alert" aria-live="assertive">
          {{ error }}
        </div>

        <UiButton
          type="submit"
          size="lg"
          class="w-full"
          :loading="loading"
          :disabled="tokenMissing || passwordMismatch"
        >
          {{ loading ? 'Actualizando…' : 'Actualizar contraseña' }}
        </UiButton>
      </form>

      <div class="flex justify-between items-center pt-2 border-t border-surface-200">
        <button
          type="button"
          class="text-sm text-primary-700 hover:text-primary-800"
          @click="router.push({ name: 'forgot-password' })"
        >
          Solicitar nuevo enlace
        </button>

        <button
          type="button"
          class="text-sm text-surface-600 hover:text-surface-900"
          @click="router.push({ name: 'login' })"
        >
          Volver al login
        </button>
      </div>
    </div>
  </div>
</template>
