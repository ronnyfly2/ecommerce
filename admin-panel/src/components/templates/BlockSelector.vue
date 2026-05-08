<script setup lang="ts">
const blocks = [
  {
    key: 'hero',
    label: 'Héroe',
    description: 'Banner grande con título, subtítulo y botón de acción',
    icon: '🎯'
  },
  {
    key: 'category-strip',
    label: 'Categorías',
    description: 'Carrusel de categorías con iconos',
    icon: '📂'
  },
  {
    key: 'product-grid',
    label: 'Productos',
    description: 'Grid de productos destacados',
    icon: '🛍️'
  },
  {
    key: 'flash-sale',
    label: 'Oferta Relámpago',
    description: 'Productos en descuento con contador',
    icon: '⚡'
  },
  {
    key: 'brand-carousel',
    label: 'Marcas',
    description: 'Carrusel de logos de marcas',
    icon: '⭐'
  },
  {
    key: 'trust-badges',
    label: 'Garantías',
    description: 'Iconos de garantía, envío, etc.',
    icon: '✓'
  },
  {
    key: 'promo-banners',
    label: 'Banners Promocionales',
    description: 'Banners grandes con imágenes y textos',
    icon: '🎨'
  },
  {
    key: 'rich-text',
    label: 'Texto Enriquecido',
    description: 'Sección de texto con formato',
    icon: '📝'
  },
  {
    key: 'cta',
    label: 'Llamado a Acción',
    description: 'Sección con botón prominente',
    icon: '🎁'
  },
  {
    key: 'banner',
    label: 'Aviso',
    description: 'Banner de noticia o aviso (envío gratis, etc.)',
    icon: '📢'
  }
]

const emit = defineEmits<{
  select: [key: string]
}>()
</script>

<template>
  <div>
    <h3 class="text-lg font-semibold mb-4 text-gray-800">Agregar sección</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        v-for="block in blocks"
        :key="block.key"
        @click="emit('select', block.key)"
        class="text-left p-4 rounded-lg border border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-colors cursor-pointer group"
      >
        <div class="flex items-start gap-3">
          <span class="text-2xl group-hover:scale-110 transition-transform">{{ block.icon }}</span>
          <div>
            <p class="font-semibold text-gray-800 group-hover:text-primary-700">{{ block.label }}</p>
            <p class="text-xs text-gray-500 mt-1">{{ block.description }}</p>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>
