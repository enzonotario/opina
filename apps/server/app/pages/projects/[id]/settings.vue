<script setup lang="ts">
import type { ProjectDto } from '../../../shared/projects'

const route = useRoute()
const id = computed(() => String(route.params.id))
const toast = useToast()
const config = useRuntimeConfig()

const { data, refresh, error } = await useFetch<{ project: ProjectDto }>(
  () => `/api/admin/projects/${id.value}`,
)

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    statusMessage: error.value.statusMessage || 'Project not found',
  })
}

const name = ref(data.value!.project.name)
const originsText = ref(data.value!.project.allowedOrigins.join('\n'))
const pending = ref(false)
const formError = ref('')

const publicUrl = computed(() =>
  String(config.public.url || 'http://localhost:3000').replace(/\/$/, ''),
)

const snippet = computed(() => {
  const key = data.value?.project.publicKey || 'pk_xxx'
  return [
    '<script',
    `  src="${publicUrl.value}/widget.js"`,
    `  data-key="${key}"`,
    '  defer',
    '></' + 'script>',
  ].join('\n')
})

function parseOrigins(value: string) {
  return value
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean)
}

async function save() {
  formError.value = ''
  pending.value = true
  try {
    await $fetch(`/api/admin/projects/${id.value}`, {
      method: 'PATCH',
      body: {
        name: name.value,
        allowedOrigins: parseOrigins(originsText.value),
      },
    })
    await refresh()
    toast.add({ title: 'Settings saved', color: 'success' })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, statusMessage?: string }
    formError.value = err.data?.statusMessage || err.statusMessage || 'Save failed'
  } finally {
    pending.value = false
  }
}

async function rotateKey() {
  if (!confirm('Create a new key? You’ll need to update the install snippet on your site.')) {
    return
  }
  await $fetch(`/api/admin/projects/${id.value}/rotate-key`, { method: 'POST' })
  await refresh()
  toast.add({ title: 'Public key rotated', color: 'success' })
}

async function removeProject() {
  if (!confirm(`Delete project “${data.value?.project.name}”? This cannot be undone.`)) {
    return
  }
  await $fetch(`/api/admin/projects/${id.value}`, { method: 'DELETE' })
  toast.add({ title: 'Project deleted', color: 'success' })
  await navigateTo('/')
}

async function copySnippet() {
  await navigator.clipboard.writeText(snippet.value)
  toast.add({ title: 'Snippet copied', color: 'success' })
}

async function copyKey() {
  await navigator.clipboard.writeText(data.value!.project.publicKey)
  toast.add({ title: 'Key copied', color: 'success' })
}
</script>

<template>
  <UDashboardPanel
    :id="`project-settings-${id}`"
    :ui="{ body: 'lg:py-10' }"
  >
    <template #header>
      <UDashboardNavbar title="Settings">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <span class="text-xs font-mono text-muted truncate max-w-48">
            {{ data?.project.publicKey }}
          </span>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-6 w-full max-w-2xl mx-auto">
        <form
          class="space-y-4"
          @submit.prevent="save"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="font-medium text-highlighted">
                Project
              </h2>
              <p class="text-sm text-muted mt-0.5">
                Name and websites where surveys can appear.
              </p>
            </div>
            <UButton
              type="submit"
              :loading="pending"
              label="Save changes"
              class="shrink-0"
            />
          </div>

          <div class="rounded-lg border border-default bg-elevated/50 divide-y divide-default">
            <div class="p-4">
              <UFormField
                label="Name"
                name="name"
                required
                class="flex max-sm:flex-col justify-between items-start gap-4"
              >
                <UInput
                  v-model="name"
                  class="w-full sm:w-64"
                  required
                />
              </UFormField>
            </div>
            <div class="p-4">
              <UFormField
                label="Allowed websites"
                name="origins"
                description="One URL per line."
                class="flex max-sm:flex-col justify-between items-start gap-4"
                :ui="{ container: 'w-full sm:max-w-sm' }"
              >
                <UTextarea
                  v-model="originsText"
                  class="w-full"
                  :rows="4"
                  placeholder="https://example.com"
                />
              </UFormField>
            </div>
          </div>

          <UAlert
            v-if="formError"
            color="error"
            variant="subtle"
            :title="formError"
          />
        </form>

        <section class="space-y-3">
          <div>
            <h2 class="font-medium text-highlighted">
              Site key
            </h2>
            <p class="text-sm text-muted mt-0.5">
              Used in the install snippet on your website.
            </p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/50 p-4 flex flex-wrap items-center gap-2">
            <code class="rounded bg-muted px-2 py-1 text-sm font-mono">
              {{ data?.project.publicKey }}
            </code>
            <UButton
              size="sm"
              color="neutral"
              variant="ghost"
              label="Copy"
              @click="copyKey"
            />
            <UButton
              size="sm"
              color="neutral"
              variant="outline"
              label="Reset key"
              @click="rotateKey"
            />
          </div>
        </section>

        <section class="space-y-3">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="font-medium text-highlighted">
                Install on your site
              </h2>
              <p class="text-sm text-muted mt-0.5">
                Paste this before the closing &lt;/body&gt; tag.
              </p>
            </div>
            <UButton
              size="sm"
              color="neutral"
              variant="ghost"
              label="Copy"
              class="shrink-0"
              @click="copySnippet"
            />
          </div>
          <pre class="overflow-x-auto rounded-lg border border-default bg-elevated/50 p-4 text-sm font-mono whitespace-pre-wrap">{{ snippet }}</pre>
        </section>

        <section class="space-y-3 border-t border-default pt-6">
          <div>
            <h2 class="font-medium text-highlighted">
              Delete project
            </h2>
            <p class="text-sm text-muted mt-0.5">
              This permanently removes surveys and responses.
            </p>
          </div>
          <UButton
            color="error"
            variant="soft"
            label="Delete project"
            @click="removeProject"
          />
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
