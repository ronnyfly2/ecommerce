const env = (globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>
  }
}).process?.env ?? {}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  devServer: {
    port: 3003,
  },

  nitro: {
    devProxy: {
      '/backend-api': {
        target: env.NUXT_PUBLIC_ADMIN_API_BASE || 'http://localhost:3000/api',
        changeOrigin: true,
      }
    }
  },

  runtimeConfig: {
    public: {
      adminApiBase: env.NUXT_PUBLIC_ADMIN_API_BASE || 'http://localhost:3000/api',
      homeTemplateKey: env.NUXT_PUBLIC_HOME_TEMPLATE_KEY || 'home.minimal'
    }
  },

  routeRules: {
    '/': { prerender: true }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
