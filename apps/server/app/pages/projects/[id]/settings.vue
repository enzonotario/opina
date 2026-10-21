<script setup lang="ts">
import type { WebhookDto } from '#shared/webhooks'
import { normalizeHttpUrl, type ProjectDto } from '#shared/projects'

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

const { data: webhookData, refresh: refreshWebhooks } = await useFetch<{ webhooks: WebhookDto[] }>(
  () => `/api/admin/projects/${id.value}/webhooks`,
)

const hookName = ref('')
const hookUrl = ref('')
const hookSecret = ref('')
const hookPending = ref(false)
const hookError = ref('')

const name = ref(data.value!.project.name)
const homepage = ref(data.value!.project.homepage || '')
const logoUrl = ref(data.value!.project.logoUrl || '')
const originsText = ref(data.value!.project.allowedOrigins.join('\n'))
const pending = ref(false)
const formError = ref('')
const faviconPending = ref(false)
const autoLogo = ref('')
const autoPage = ref('')

let faviconTimer: ReturnType<typeof setTimeout> | undefined
watch(homepage, (value) => {
  clearTimeout(faviconTimer)
  if (!value.trim().includes('.')) return
  faviconTimer = setTimeout(() => {
    void applyFavicon(false)
  }, 400)
})

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
    '',
    '<!-- Optional: page feedback slot (survey type “Page feedback”) -->',
    '<!-- <div data-opina-slot="srv_xxx"></div> -->',
  ].join('\n')
})

function parseOrigins(value: string) {
  return value
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean)
}

function optionalUrl(value: string) {
  try {
    return normalizeHttpUrl(value)
  } catch {
    throw new Error('Home page and logo must be http(s) URLs')
  }
}

async function applyFavicon(force = false) {
  const page = homepage.value.trim()
  if (!page) return
  let pageUrl: string | null
  try {
    pageUrl = normalizeHttpUrl(page)
  } catch {
    return
  }
  if (!pageUrl) return
  const current = logoUrl.value.trim()
  if (!force && current && current !== autoLogo.value) return
  if (!force && pageUrl === autoPage.value && current === autoLogo.value) return
  faviconPending.value = true
  try {
    if (homepage.value !== pageUrl) homepage.value = pageUrl
    const result = await $fetch<{ logoUrl: string | null }>('/api/admin/favicon', {
      query: { url: pageUrl },
    })
    if (result.logoUrl) {
      logoUrl.value = result.logoUrl
      autoLogo.value = result.logoUrl
      autoPage.value = pageUrl
    }
  } catch {
    // Keep whatever logo is already set. The field stays editable.
  } finally {
    faviconPending.value = false
  }
}

async function save() {
  formError.value = ''
  pending.value = true
  try {
    const homepageUrl = optionalUrl(homepage.value)
    const logo = optionalUrl(logoUrl.value)
    await $fetch(`/api/admin/projects/${id.value}`, {
      method: 'PATCH',
      body: {
        name: name.value,
        homepage: homepageUrl,
        logoUrl: logo,
        allowedOrigins: parseOrigins(originsText.value),
      },
    })
    homepage.value = homepageUrl || ''
    logoUrl.value = logo || ''
    await refresh()
    toast.add({ title: 'Settings saved', color: 'success' })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, statusMessage?: string, message?: string }
    formError.value = err.data?.statusMessage || err.statusMessage || err.message || 'Save failed'
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

function deliveryLabel(hook: WebhookDto) {
  if (!hook.lastDeliveryAt) return 'No deliveries yet'
  if (hook.lastStatus && hook.lastStatus >= 200 && hook.lastStatus < 300) return 'Last delivery ok'
  return hook.lastError || 'Last delivery failed'
}

async function addWebhook() {
  hookError.value = ''
  hookPending.value = true
  try {
    await $fetch(`/api/admin/projects/${id.value}/webhooks`, {
      method: 'POST',
      body: { name: hookName.value, url: hookUrl.value, secret: hookSecret.value },
    })
    hookName.value = ''
    hookUrl.value = ''
    hookSecret.value = ''
    await refreshWebhooks()
    toast.add({ title: 'Webhook added', color: 'success' })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, statusMessage?: string }
    hookError.value = err.data?.statusMessage || err.statusMessage || 'Could not add webhook'
  } finally {
    hookPending.value = false
  }
}

async function toggleWebhook(hook: WebhookDto, enabled: boolean) {
  await $fetch(`/api/admin/projects/${id.value}/webhooks/${hook.id}`, {
    method: 'PATCH',
    body: { enabled },
  })
  await refreshWebhooks()
}

async function removeWebhook(hook: WebhookDto) {
  if (!confirm(`Delete webhook “${hook.name}”?`)) return
  await $fetch(`/api/admin/projects/${id.value}/webhooks/${hook.id}`, { method: 'DELETE' })
  await refreshWebhooks()
  toast.add({ title: 'Webhook deleted', color: 'success' })
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
                label="Home page"
                name="homepage"
                description="Optional. The logo is taken from this site’s favicon."
                class="flex max-sm:flex-col justify-between items-start gap-4"
              >
                <UInput
                  v-model="homepage"
                  type="text"
                  placeholder="https://example.com"
                  class="w-full sm:w-64"
                />
              </UFormField>
            </div>
            <div class="p-4">
              <UFormField
                label="Logo"
                name="logo"
                description="Optional. Change it if the favicon is not the one you want."
                class="flex max-sm:flex-col justify-between items-start gap-4"
                :ui="{ container: 'w-full sm:max-w-sm' }"
              >
                <div class="flex items-center gap-2 w-full">
                  <ProjectMark
                    :name="name || 'P'"
                    :logo-url="logoUrl"
                    class="size-8"
                  />
                  <UInput
                    v-model="logoUrl"
                    type="text"
                    placeholder="https://example.com/favicon.ico"
                    class="flex-1"
                  />
                  <UButton
                    type="button"
                    size="sm"
                    color="neutral"
                    variant="outline"
                    label="Favicon"
                    :loading="faviconPending"
                    :disabled="!homepage.trim()"
                    @click="applyFavicon(true)"
                  />
                </div>
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
              Webhooks
            </h2>
            <p class="text-sm text-muted mt-0.5">
              Opina POSTs each new response as JSON. The request includes
              <code>Authorization: Bearer</code> with the secret and
              <code>X-Opina-Signature: sha256=…</code> over the raw body.
              Event: <code>response.created</code>.
            </p>
          </div>

          <div
            v-if="webhookData?.webhooks.length"
            class="rounded-lg border border-default bg-elevated/50 divide-y divide-default"
          >
            <div
              v-for="hook in webhookData.webhooks"
              :key="hook.id"
              class="p-4 flex items-start justify-between gap-4"
            >
              <div class="min-w-0">
                <p class="font-medium text-highlighted truncate">
                  {{ hook.name }}
                </p>
                <p class="text-sm text-muted truncate">
                  {{ hook.url }}
                </p>
                <p class="text-xs text-muted mt-1">
                  Secret ····{{ hook.secretTail }} · {{ deliveryLabel(hook) }}
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <USwitch
                  :model-value="hook.enabled"
                  @update:model-value="toggleWebhook(hook, Boolean($event))"
                />
                <UButton
                  size="sm"
                  color="error"
                  variant="ghost"
                  label="Delete"
                  @click="removeWebhook(hook)"
                />
              </div>
            </div>
          </div>

          <form
            class="rounded-lg border border-default bg-elevated/50 p-4 space-y-3"
            @submit.prevent="addWebhook"
          >
            <UFormField label="Name" name="hook-name" required>
              <UInput
                v-model="hookName"
                class="w-full"
                placeholder="Notifications"
                required
              />
            </UFormField>
            <UFormField label="URL" name="hook-url" required>
              <UInput
                v-model="hookUrl"
                class="w-full"
                type="url"
                placeholder="https://example.com/hooks/opina"
                required
              />
            </UFormField>
            <UFormField
              label="Secret"
              name="hook-secret"
              description="At least 16 characters. Sent as a bearer token and used to sign the body."
              required
            >
              <UInput
                v-model="hookSecret"
                class="w-full"
                type="password"
                required
                minlength="16"
              />
            </UFormField>
            <UAlert
              v-if="hookError"
              color="error"
              variant="subtle"
              :title="hookError"
            />
            <UButton
              type="submit"
              :loading="hookPending"
              label="Add webhook"
            />
          </form>
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
