<script setup lang="ts">
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'

type ProductFeatureItem = {
  icon: string
  name: string
}

defineProps<{
  features: ProductFeatureItem[]
  featureError: string
  addFeature: () => void
  removeFeature: (index: number) => void
}>()
</script>

<template>
  <div class="lg:col-span-2 form-panel space-y-3">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-sm font-medium text-surface-700">Caracteristicas</p>
        <p class="text-xs text-surface-500">
          Agrega una o mas caracteristicas con icono/imagen SVG y nombre.
        </p>
      </div>
      <UiButton type="button" size="sm" variant="secondary" @click="addFeature">
        Agregar caracteristica
      </UiButton>
    </div>

    <p v-if="featureError" class="text-xs text-danger-600">
      {{ featureError }}
    </p>

    <div class="space-y-3">
      <div
        v-for="(feature, index) in features"
        :key="`feature-${index}`"
        class="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-3"
      >
        <UiInput
          v-model="feature.icon"
          label="Icono o imagen SVG"
          size="lg"
          placeholder="https://cdn.shop.com/icons/secure.svg o icon-shield"
        />
        <UiInput
          v-model="feature.name"
          label="Nombre"
          size="lg"
          placeholder="Pago seguro"
        />
        <div class="flex items-end">
          <UiButton
            type="button"
            size="sm"
            variant="danger"
            class="w-full lg:w-auto"
            :disabled="features.length === 1"
            @click="removeFeature(index)"
          >
            Quitar
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>