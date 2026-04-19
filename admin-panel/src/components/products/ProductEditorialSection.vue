<script setup lang="ts">
import UiTextarea from '@/components/ui/UiTextarea.vue'

type EditorialFormModel = {
  description: string
  graphicDescription: string
  usageMode: string
}

defineProps<{
  form: EditorialFormModel
  richTextEditor: unknown
  editorToolbar: unknown[]
  descriptionLength: number
  graphicDescriptionLength: number
  usageModeLength: number
}>()
</script>

<template>
  <div class="lg:col-span-2">
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-surface-700">Descripcion</label>
      <div class="rounded-xl border border-surface-200 bg-surface-0 overflow-hidden">
        <component
          :is="richTextEditor"
          v-model:content="form.description"
          contentType="html"
          theme="snow"
          :toolbar="editorToolbar"
          placeholder="Detalles del producto, composicion, fit, recomendaciones de uso..."
        />
      </div>
      <p class="text-xs text-surface-500">{{ descriptionLength }} caracteres</p>
    </div>
  </div>

  <div class="lg:col-span-2 grid grid-cols-1 xl:grid-cols-2 gap-4">
    <UiTextarea
      v-model="form.graphicDescription"
      size="lg"
      :rows="4"
      label="Graphic Description"
      placeholder="Describe visual style, silhouette, textures, and key visual cues."
    />
    <UiTextarea
      v-model="form.usageMode"
      size="lg"
      :rows="4"
      label="Usage Mode"
      placeholder="Explain how to use or wear the product in practical scenarios."
    />
    <p class="text-xs text-surface-500">
      Graphic Description: {{ graphicDescriptionLength }} chars
    </p>
    <p class="text-xs text-surface-500">
      Usage Mode: {{ usageModeLength }} chars
    </p>
  </div>
</template>