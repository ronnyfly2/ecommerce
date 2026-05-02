<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  lat?: string | number | null
  lng?: string | number | null
  label?: string | null
  zoom?: number
}>()

const zoom = computed(() => props.zoom ?? 14)

const coords = computed(() => {
  const lat = props.lat != null ? Number(props.lat) : null
  const lng = props.lng != null ? Number(props.lng) : null
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null
  }
  return { lat, lng }
})

const embedSrc = computed(() => {
  if (!coords.value) return null
  const { lat, lng } = coords.value
  const delta = 0.008 * (14 / zoom.value)
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
})

const externalUrl = computed(() => {
  if (!coords.value) return null
  const { lat, lng } = coords.value
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom.value}/${lat}/${lng}`
})
</script>

<template>
  <div class="rounded-md border border-surface-200 overflow-hidden">
    <div v-if="!embedSrc" class="p-6 text-center text-sm text-muted bg-surface-50">
      Sin coordenadas de destino. Configura latitud y longitud para ver el mapa.
    </div>
    <template v-else>
      <iframe
        :src="embedSrc"
        class="w-full h-64 border-0"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        :title="label ?? 'Mapa de destino'"
      />
      <div class="flex items-center justify-between px-3 py-2 text-xs bg-surface-50 border-t border-surface-200">
        <span class="text-muted truncate">{{ label ?? `${coords?.lat}, ${coords?.lng}` }}</span>
        <a
          :href="externalUrl ?? '#'"
          target="_blank"
          rel="noopener"
          class="text-primary-700 hover:underline"
        >
          Abrir en OpenStreetMap
        </a>
      </div>
    </template>
  </div>
</template>
