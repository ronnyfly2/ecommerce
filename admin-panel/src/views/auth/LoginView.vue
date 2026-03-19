<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/utils/error'
import UiToastContainer from '@/components/ui/UiToastContainer.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'

const router = useRouter()
const route  = useRoute()
const auth   = useAuthStore()
const toast  = useToast()

const form = reactive({ email: '', password: '' })
const error = ref('')
const showSeedButtons = import.meta.env.DEV

const seedCredentials = {
  superAdminEmail: import.meta.env.VITE_SEED_SUPER_ADMIN_EMAIL || 'superadmin@local.dev',
  superAdminPassword: import.meta.env.VITE_SEED_SUPER_ADMIN_PASSWORD || 'SuperAdmin2026!',
  adminEmail: import.meta.env.VITE_SEED_ADMIN_EMAIL || 'admin@local.dev',
  adminPassword: import.meta.env.VITE_SEED_ADMIN_PASSWORD || 'Admin2026!',
}

function fillSuperAdminSeed() {
  form.email = seedCredentials.superAdminEmail
  form.password = seedCredentials.superAdminPassword
}

function fillAdminSeed() {
  form.email = seedCredentials.adminEmail
  form.password = seedCredentials.adminPassword
}

async function submit() {
  error.value = ''
  try {
    await auth.login(form)
    const redirect = String(route.query.redirect ?? '/dashboard')
    router.push(redirect)
  } catch (e) {
    error.value = extractErrorMessage(e, 'Credenciales incorrectas')
    toast.error('Error al iniciar sesión', error.value)
  }
}
</script>

<template>
  <div class="min-h-screen bg-[--color-surface-100] flex items-center justify-center p-4">
    <UiToastContainer />

    <div class="w-full max-w-sm">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex w-14 h-14 rounded-2xl bg-[--color-primary-600] items-center justify-center mb-4">
          <svg class="w-8 h-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
          </svg>
        </div>
        <h1 class="text-heading-2">Admin Panel</h1>
        <p class="text-muted mt-1">Ingresá con tu cuenta de administrador</p>
      </div>

      <!-- Card -->
      <div class="card p-6 space-y-4">
        <div v-if="showSeedButtons" class="rounded-lg border border-[--color-surface-200] bg-[--color-surface-50] p-3">
          <p class="text-caption mb-2">Acceso rapido con seed (desarrollo)</p>
          <div class="flex flex-col sm:flex-row gap-2">
            <UiButton
              type="button"
              variant="secondary"
              size="sm"
              class="flex-1"
              @click="fillSuperAdminSeed"
            >
              Usar SUPER_ADMIN seed
            </UiButton>
            <UiButton
              type="button"
              variant="ghost"
              size="sm"
              class="flex-1"
              @click="fillAdminSeed"
            >
              Usar ADMIN seed
            </UiButton>
          </div>
        </div>

        <form @submit.prevent="submit" class="space-y-4">
          <UiInput
            id="login-email"
            v-model="form.email"
            label="Email"
            type="email"
            autocomplete="email"
            placeholder="admin@tienda.com"
            required
          />

          <UiInput
            id="login-password"
            v-model="form.password"
            label="Contraseña"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            required
          />

          <div class="flex justify-end">
            <button
              type="button"
              class="text-sm text-[--color-primary-700] hover:text-[--color-primary-800]"
              @click="router.push({ name: 'forgot-password' })"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <div v-if="error" class="text-sm text-[--color-danger-600] bg-[--color-danger-50] rounded-lg px-3 py-2">
            {{ error }}
          </div>

          <UiButton
            type="submit"
            class="w-full"
            size="lg"
            :loading="auth.loading"
          >
            {{ auth.loading ? 'Ingresando…' : 'Ingresar' }}
          </UiButton>
        </form>
      </div>
    </div>
  </div>
</template>
