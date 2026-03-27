<template>
  <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
    <div v-if="$slots.filters" class="flex flex-wrap gap-3">
      <slot name="filters" />
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2 justify-start xl:justify-end">
      <slot name="actions" />
    </div>
  </div>
</template>
