<script setup lang="ts">
const config = useRuntimeConfig()
const homeTemplateKey = (config.public.homeTemplateKey as string) || 'home.minimal'
const { template, usingFallback, templateError } = useTemplate(homeTemplateKey)
</script>

<template>
  <div>
    <UContainer class="pt-6">
      <UAlert
        v-if="usingFallback"
        color="warning"
        title="Modo fallback activo"
        description="No se pudo cargar template remoto, se uso estructura local segura."
      />
      <UAlert
        v-if="templateError"
        class="mt-4"
        color="error"
        title="Error de template"
        :description="templateError"
      />
    </UContainer>

    <TemplateRenderer :template="template" />
  </div>
</template>
