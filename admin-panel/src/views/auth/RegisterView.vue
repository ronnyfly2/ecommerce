<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/utils/error'
import UiToastContainer from '@/components/ui/UiToastContainer.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  acceptTerms: false,
})

const error = ref('')

async function submit() {
  error.value = ''

  if (!form.acceptTerms) {
    error.value = 'Debes aceptar los terminos para continuar'
    return
  }

  try {
    await auth.register({
      email: form.email,
      password: form.password,
      firstName: form.firstName,
      lastName: form.lastName,
      role: 'SUPERADMIN_USER',
    })
    toast.success('Registro exitoso', 'Bienvenido al panel')
    await router.push('/dashboard')
  } catch (e) {
    error.value = extractErrorMessage(e, 'Error al registrar el usuario')
    toast.error('Error al registrar', error.value)
  }
}
</script>

<template>
  <div class="min-h-screen bg-surface-100 flex items-center justify-center p-4">
    <UiToastContainer />

    <div class="w-full max-w-lg">
      <div class="text-center mb-8">
        <h1 class="text-heading-2">Crear cuenta SUPERADMIN_USER</h1>
        <p class="text-muted mt-1">Solo este rol puede usar este panel</p>
      </div>

      <div class="card p-6 space-y-4">
        <form class="space-y-4" @submit.prevent="submit">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UiInput
              id="register-first-name"
              v-model="form.firstName"
              label="Nombre"
              size="lg"
              autocomplete="given-name"
              placeholder="Ronny"
              required
            />

            <UiInput
              id="register-last-name"
              v-model="form.lastName"
              label="Apellido"
              size="lg"
              autocomplete="family-name"
              placeholder="Cabrera"
              required
            />
          </div>

          <UiInput
            id="register-email"
            v-model="form.email"
            label="Email"
            size="lg"
            type="email"
            autocomplete="email"
            placeholder="admin@tienda.com"
            required
          />

          <UiInput
            id="register-password"
            v-model="form.password"
            label="Contraseña"
            size="lg"
            type="password"
            autocomplete="new-password"
            placeholder="Minimo 8 caracteres"
            required
          />

          <label class="flex items-start gap-2 text-sm text-surface-700">
            <input v-model="form.acceptTerms" type="checkbox" class="mt-1 h-4 w-4 rounded border-surface-300" />
            <span>Acepto los terminos de uso para cuentas SUPERADMIN_USER</span>
          </label>

          <div v-if="error" class="text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2" role="alert" aria-live="assertive">
            {{ error }}
          </div>

          <UiButton type="submit" class="w-full" size="lg" :loading="auth.loading">
            {{ auth.loading ? 'Registrando…' : 'Crear cuenta' }}
          </UiButton>

          <p class="text-sm text-center text-muted">
            ¿Ya tienes cuenta?
            <button
              type="button"
              class="font-medium text-primary-700 hover:text-primary-800"
              @click="router.push({ name: 'login' })"
            >
              Inicia sesion
            </button>
          </p>
        </form>
      </div>
    </div>
  </div>
</template>
