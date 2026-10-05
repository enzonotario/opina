<script setup lang="ts">
defineProps<{
  collapsed?: boolean
  variant?: 'ghost' | 'soft'
}>()

const { projects, currentProject, projectId, refresh } = useProjectsNav()
const open = ref(false)
const search = ref('')

watch(open, (v) => {
  if (v) refresh()
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return projects.value
  return projects.value.filter(p =>
    p.name.toLowerCase().includes(q) || p.publicKey.toLowerCase().includes(q),
  )
})

async function go(to: string) {
  open.value = false
  search.value = ''
  await navigateTo(to)
}

const label = computed(() => currentProject.value?.name || 'Select project')
const initial = computed(() => (label.value || 'O').slice(0, 1).toUpperCase())
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ align: 'start', collisionPadding: 8 }"
  >
    <button
      type="button"
      class="group flex items-center gap-2 min-w-0 rounded-md transition-colors"
      :class="[
        collapsed ? 'justify-center p-1.5' : 'px-2 py-1.5 w-full',
        variant === 'soft'
          ? 'bg-elevated hover:bg-elevated/80 ring-1 ring-default'
          : 'hover:bg-elevated',
      ]"
    >
      <span
        class="size-6 rounded-md flex items-center justify-center text-[11px] font-semibold shrink-0"
        :class="currentProject ? 'bg-primary text-inverted' : 'bg-muted text-muted'"
      >
        {{ initial }}
      </span>
      <span
        v-if="!collapsed"
        class="truncate text-sm font-semibold text-highlighted min-w-0 flex-1 text-left"
      >
        {{ label }}
      </span>
      <UIcon
        v-if="!collapsed"
        name="i-lucide-chevron-down"
        class="size-4 text-dimmed shrink-0 group-data-[state=open]:rotate-180 transition-transform"
      />
    </button>

    <template #content>
      <div class="w-80 p-2 space-y-2">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search projects…"
          size="sm"
          autofocus
        />

        <div class="max-h-72 overflow-y-auto space-y-0.5">
          <button
            v-for="p in filtered"
            :key="p.id"
            type="button"
            class="w-full flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-left hover:bg-elevated"
            :class="projectId === p.id ? 'bg-elevated' : ''"
            @click="go(`/projects/${p.id}`)"
          >
            <span class="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
              {{ p.name.slice(0, 1).toUpperCase() }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium text-highlighted">{{ p.name }}</span>
              <span class="block truncate text-[11px] text-muted">
                {{ p.stats30d?.total ?? 0 }} responses · 30d
              </span>
            </span>
            <UIcon
              v-if="projectId === p.id"
              name="i-lucide-check"
              class="size-4 text-primary shrink-0"
            />
          </button>

          <p
            v-if="!filtered.length"
            class="px-2 py-4 text-xs text-muted text-center"
          >
            No projects
          </p>
        </div>

        <div class="border-t border-default pt-2 grid grid-cols-2 gap-1">
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium hover:bg-elevated"
            @click="go('/projects')"
          >
            <UIcon
              name="i-lucide-layout-grid"
              class="size-3.5"
            />
            All projects
          </button>
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium hover:bg-elevated"
            @click="go('/projects?new=1')"
          >
            <UIcon
              name="i-lucide-plus"
              class="size-3.5"
            />
            New
          </button>
        </div>
      </div>
    </template>
  </UPopover>
</template>
