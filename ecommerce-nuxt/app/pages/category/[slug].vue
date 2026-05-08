<script setup lang="ts">
const route = useRoute()

const { template, usingFallback, templateError } = useTemplate('category.default')

const categoryName = computed(() => String(route.params.slug ?? 'default'))
</script>

<template>
  <div>
    <UContainer class="pt-6">
      <UBadge color="neutral" variant="subtle">
        Categoria: {{ categoryName }}
      </UBadge>
      <UAlert
        v-if="usingFallback"
        class="mt-4"
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
