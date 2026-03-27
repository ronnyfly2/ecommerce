<script setup lang="ts">
const props = withDefaults(defineProps<{
  createdAt?: string | null
  updatedAt?: string | null
  locale?: string
}>(), {
  locale: 'es-AR',
})

function formatDate(value?: string | null) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleDateString(props.locale)
}
</script>

<template>
  <td class="table-td text-muted text-xs">{{ formatDate(props.createdAt) }}</td>
  <td class="table-td text-muted text-xs">{{ formatDate(props.updatedAt) }}</td>
</template>
