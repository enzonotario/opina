<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const open = ref(false)

useDashboard()

const { projectId, inProject } = useProjectsNav()

const orgLinks = computed(() => [[{
  label: 'Dashboard',
  icon: 'i-lucide-layout-dashboard',
  to: '/',
  exact: true,
  onSelect: () => { open.value = false },
}, {
  label: 'Projects',
  icon: 'i-lucide-folder-kanban',
  to: '/projects',
  exact: true,
  onSelect: () => { open.value = false },
}, {
  label: 'Instance',
  icon: 'i-lucide-server',
  to: '/instance',
  onSelect: () => { open.value = false },
}]] satisfies NavigationMenuItem[][])

const projectLinks = computed(() => {
  const id = projectId.value
  if (!id) return [[]] as NavigationMenuItem[][]
  return [[
    {
      label: 'Overview',
      icon: 'i-lucide-layout-dashboard',
      to: `/projects/${id}`,
      exact: true,
      onSelect: () => { open.value = false },
    },
    {
      label: 'Responses',
      icon: 'i-lucide-messages-square',
      to: `/projects/${id}/responses`,
      onSelect: () => { open.value = false },
    },
    {
      label: 'Surveys',
      icon: 'i-lucide-list-checks',
      to: `/projects/${id}/surveys`,
      onSelect: () => { open.value = false },
    },
    {
      label: 'Settings',
      icon: 'i-lucide-settings',
      to: `/projects/${id}/settings`,
      onSelect: () => { open.value = false },
    },
  ]] satisfies NavigationMenuItem[][]
})

const links = computed(() => inProject.value ? projectLinks.value : orgLinks.value)

const groups = computed(() => [{
  id: 'links',
  label: 'Go to',
  items: [
    ...links.value.flat(),
    ...(inProject.value
      ? [{ label: 'Home', icon: 'i-lucide-arrow-left', to: '/' }]
      : []),
  ],
}])
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{
        header: 'border-b border-default h-auto min-h-16 py-3',
        footer: 'lg:border-t lg:border-default',
        body: 'gap-1',
      }"
    >
      <template #header="{ collapsed }">
        <div
          v-if="!inProject"
          class="w-full min-w-0"
        >
          <NuxtLink
            to="/"
            class="flex items-center gap-2.5 px-1 py-0.5 rounded-md hover:bg-elevated min-w-0"
            @click="open = false"
          >
            <span class="size-7 rounded-lg bg-primary flex items-center justify-center text-inverted text-sm font-bold shrink-0">
              O
            </span>
            <span
              v-if="!collapsed"
              class="font-semibold text-highlighted truncate"
            >
              Opina
            </span>
          </NuxtLink>
        </div>
        <div
          v-else
          class="w-full min-w-0 space-y-2"
        >
          <NuxtLink
            v-if="!collapsed"
            to="/"
            class="flex items-center gap-1.5 px-1 text-xs text-muted hover:text-highlighted"
            @click="open = false"
          >
            <span class="size-4 rounded bg-primary text-inverted text-[9px] font-bold flex items-center justify-center">O</span>
            Opina
          </NuxtLink>
          <ProjectSwitcher
            :collapsed="collapsed"
            variant="soft"
          />
        </div>
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton
          :collapsed="collapsed"
          class="bg-transparent ring-default mb-1"
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />

        <UButton
          v-if="inProject"
          to="/"
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-arrow-left"
          :label="collapsed ? undefined : 'Home'"
          :square="collapsed"
          class="mt-4"
          block
          @click="open = false"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <slot />
  </UDashboardGroup>
</template>
