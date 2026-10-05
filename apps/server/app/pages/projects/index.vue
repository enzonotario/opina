<script setup lang="ts">
import type { ProjectDto } from '../../../shared/projects'

type ProjectRow = ProjectDto & {
  stats30d: { total: number, csatPercent: number | null }
}

const toast = useToast()

const { data, refresh, status } = await useFetch<{ projects: ProjectRow[] }>(
  '/api/admin/projects',
)

const route = useRoute()
const createOpen = ref(route.query.new === '1')

watch(() => route.query.new, (v) => {
  if (v === '1') createOpen.value = true
})
const name = ref('')
const originsText = ref('')
const pending = ref(false)
const error = ref('')

function parseOrigins(value: string) {
  return value
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean)
}

async function createProject() {
  error.value = ''
  pending.value = true
  try {
    const { project } = await $fetch<{ project: ProjectDto }>('/api/admin/projects', {
      method: 'POST',
      body: {
        name: name.value,
        allowedOrigins: parseOrigins(originsText.value),
      },
    })
    createOpen.value = false
    name.value = ''
    originsText.value = ''
    await refresh()
    toast.add({ title: 'Project created', color: 'success' })
    await navigateTo(`/projects/${project.id}`)
  }
  catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, statusMessage?: string }
    error.value = err.data?.statusMessage || err.statusMessage || 'Could not create project'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <UDashboardPanel
    id="projects"
    :ui="{ body: 'lg:py-10' }"
  >
    <template #header>
      <UDashboardNavbar title="Projects">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UModal
            v-model:open="createOpen"
            title="New project"
            description="Give it a name and add the websites where surveys can appear."
          >
            <UButton
              label="New project"
              icon="i-lucide-plus"
            />
            <template #body>
              <form
                class="space-y-4"
                @submit.prevent="createProject"
              >
                <UFormField
                  label="Name"
                  name="name"
                  required
                >
                  <UInput
                    v-model="name"
                    class="w-full"
                    placeholder="My site"
                    required
                  />
                </UFormField>
                <UFormField
                  label="Websites"
                  name="origins"
                  hint="One per line"
                >
                  <UTextarea
                    v-model="originsText"
                    class="w-full"
                    :rows="3"
                    placeholder="https://example.com"
                  />
                </UFormField>
                <UAlert
                  v-if="error"
                  color="error"
                  variant="subtle"
                  :title="error"
                />
                <div class="flex justify-end gap-2">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    label="Cancel"
                    @click="createOpen = false"
                  />
                  <UButton
                    type="submit"
                    :loading="pending"
                    label="Create"
                  />
                </div>
              </form>
            </template>
          </UModal>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full max-w-3xl mx-auto">
        <div
          v-if="status === 'pending'"
          class="text-muted text-sm"
        >
          Loading projects…
        </div>

        <div
          v-else-if="!data?.projects?.length"
          class="rounded-lg border border-dashed border-default p-8 text-center space-y-3"
        >
          <p class="text-highlighted font-medium">
            No projects yet
          </p>
          <p class="text-muted text-sm">
            Create a project to get a public key and install the widget.
          </p>
          <UButton
            label="Create first project"
            @click="createOpen = true"
          />
        </div>

        <ul
          v-else
          class="divide-y divide-default border border-default rounded-lg bg-default"
        >
          <li
            v-for="project in data.projects"
            :key="project.id"
          >
            <NuxtLink
              :to="`/projects/${project.id}`"
              class="flex items-center justify-between gap-4 px-4 py-3 hover:bg-elevated/50 transition-colors"
            >
              <div class="min-w-0">
                <p class="font-medium text-highlighted truncate">
                  {{ project.name }}
                </p>
                <p class="text-xs text-muted font-mono truncate">
                  {{ project.publicKey }}
                </p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-sm font-medium text-highlighted">
                  {{ project.stats30d.csatPercent == null ? '—' : `${project.stats30d.csatPercent}%` }}
                  <span class="text-xs text-muted font-normal">CSAT</span>
                </p>
                <p class="text-xs text-muted">
                  {{ project.stats30d.total }} responses · 30d
                </p>
              </div>
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 text-muted shrink-0"
              />
            </NuxtLink>
          </li>
        </ul>
      </div>
    </template>
  </UDashboardPanel>
</template>
