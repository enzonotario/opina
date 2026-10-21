<script setup lang="ts">
const props = defineProps<{
  name: string
  logoUrl?: string | null
  class?: string
}>()

const failed = ref(false)

watch(() => props.logoUrl, () => {
  failed.value = false
})

const initial = computed(() => (props.name || 'O').slice(0, 1).toUpperCase())
</script>

<template>
  <img
    v-if="logoUrl && !failed"
    :src="logoUrl"
    :alt="name"
    class="rounded-md object-cover bg-elevated"
    :class="props.class || 'size-6'"
    referrerpolicy="no-referrer"
    @error="failed = true"
  >
  <span
    v-else
    class="rounded-md flex items-center justify-center text-[11px] font-semibold shrink-0 bg-primary text-inverted"
    :class="props.class || 'size-6'"
  >
    {{ initial }}
  </span>
</template>
