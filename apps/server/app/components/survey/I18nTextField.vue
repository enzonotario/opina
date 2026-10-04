<script setup lang="ts">
const model = defineModel<Record<string, string>>({ required: true })

const props = withDefaults(defineProps<{
  locales: string[]
  localeLabels?: Record<string, string>
  multiline?: boolean
  rows?: number
  placeholder?: string
}>(), {
  multiline: false,
  rows: 2,
  localeLabels: () => ({}),
})

const active = ref(props.locales[0] || 'es')

watch(() => props.locales, (locales) => {
  if (!locales.length) return
  if (!locales.includes(active.value)) active.value = locales[0]!
}, { immediate: true })

const tabItems = computed(() =>
  props.locales.map(code => ({
    label: props.localeLabels[code] || code.toUpperCase(),
    value: code,
  })),
)

const text = computed({
  get: () => model.value[active.value] || '',
  set: (value: string) => {
    model.value = {
      ...model.value,
      [active.value]: value,
    }
  },
})
</script>

<template>
  <div class="space-y-2 w-full">
    <UTabs
      v-if="locales.length > 1"
      v-model="active"
      :items="tabItems"
      :content="false"
      size="xs"
      color="neutral"
      variant="link"
      class="w-full"
    />
    <UTextarea
      v-if="multiline"
      v-model="text"
      :rows="rows"
      class="w-full"
      :placeholder="placeholder"
    />
    <UInput
      v-else
      v-model="text"
      class="w-full"
      :placeholder="placeholder"
    />
  </div>
</template>
