<script setup lang="ts">
type BackupStatus = {
  enabled: boolean
  lastRunAt: number | null
  lastOk: boolean | null
  lastError: string | null
  lastKey: string | null
  lastFilesKey: string | null
  lastBytes: number | null
  retention: number
}

type AccessTokenRow = {
  id: string
  name: string
  tokenPrefix: string
  createdAt: number
  lastUsedAt: number | null
}

type CreatedToken = AccessTokenRow & { token: string }

const toast = useToast()
const config = useRuntimeConfig()
const { data, refresh, status } = await useFetch<{ backup: BackupStatus }>('/api/admin/backup/status')
const {
  data: tokensData,
  refresh: refreshTokens,
  status: tokensStatus,
} = await useFetch<{ tokens: AccessTokenRow[] }>('/api/admin/tokens')

const pending = ref(false)
const tokenName = ref('')
const creatingToken = ref(false)
const revokingId = ref<string | null>(null)
const createdPlaintext = ref<string | null>(null)

const mcpUrl = computed(() =>
  `${String(config.public.url || 'http://localhost:3000').replace(/\/$/, '')}/mcp`,
)

async function runNow() {
  pending.value = true
  try {
    await $fetch('/api/admin/backup/run', { method: 'POST' })
    await refresh()
    toast.add({ title: 'Backup completed', color: 'success' })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: err.data?.statusMessage || err.statusMessage || 'Backup failed',
      color: 'error',
    })
    await refresh()
  } finally {
    pending.value = false
  }
}

async function createToken() {
  if (!tokenName.value.trim() || creatingToken.value) return
  creatingToken.value = true
  try {
    const res = await $fetch<{ token: CreatedToken }>('/api/admin/tokens', {
      method: 'POST',
      body: { name: tokenName.value.trim() },
    })
    createdPlaintext.value = res.token.token
    tokenName.value = ''
    await refreshTokens()
    toast.add({ title: 'Token created — copy it now', color: 'success' })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: err.data?.statusMessage || err.statusMessage || 'Create failed',
      color: 'error',
    })
  } finally {
    creatingToken.value = false
  }
}

async function revokeToken(row: AccessTokenRow) {
  if (!confirm(`Revoke token “${row.name}”? MCP clients using it will stop working.`)) return
  revokingId.value = row.id
  try {
    await $fetch(`/api/admin/tokens/${row.id}`, { method: 'DELETE' })
    if (createdPlaintext.value?.startsWith(row.tokenPrefix)) {
      createdPlaintext.value = null
    }
    await refreshTokens()
    toast.add({ title: 'Token revoked', color: 'success' })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: err.data?.statusMessage || err.statusMessage || 'Revoke failed',
      color: 'error',
    })
  } finally {
    revokingId.value = null
  }
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title: `${label} copied`, color: 'success' })
  } catch {
    toast.add({ title: 'Copy failed', color: 'error' })
  }
}

function fmt(ts: number | null) {
  return ts ? new Date(ts).toLocaleString() : '—'
}

function bytes(n: number | null) {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}
</script>

<template>
  <UDashboardPanel
    id="instance"
    :ui="{ body: 'lg:py-10' }"
  >
    <template #header>
      <UDashboardNavbar title="Instance">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div
        v-if="status === 'pending' && !data"
        class="text-sm text-muted max-w-2xl mx-auto"
      >
        Loading…
      </div>

      <div
        v-else-if="data"
        class="space-y-6 w-full max-w-2xl mx-auto"
      >
        <UAlert
          v-if="!data.backup.enabled"
          color="warning"
          variant="subtle"
          title="Backups disabled"
          description="Configure S3-compatible storage in your environment to enable automatic backups."
        />

        <section class="rounded-lg border border-default p-4 bg-default space-y-4">
          <div class="space-y-1">
            <h2 class="font-medium text-highlighted">
              MCP access
            </h2>
            <p class="text-sm text-muted">
              Personal access tokens for remote MCP clients (Cursor, Claude, etc.).
              Endpoint:
              <code class="font-mono text-xs text-highlighted">{{ mcpUrl }}</code>
            </p>
          </div>

          <div class="flex flex-wrap items-end gap-2">
            <UFormField
              label="Token name"
              class="min-w-48 flex-1"
            >
              <UInput
                v-model="tokenName"
                placeholder="e.g. Cursor triage"
                size="sm"
                @keydown.enter.prevent="createToken"
              />
            </UFormField>
            <UButton
              size="sm"
              label="Create token"
              icon="i-lucide-key-round"
              :loading="creatingToken"
              :disabled="!tokenName.trim()"
              @click="createToken"
            />
          </div>

          <UAlert
            v-if="createdPlaintext"
            color="warning"
            variant="subtle"
            title="Copy this token now — it will not be shown again"
          >
            <template #description>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <code class="font-mono text-xs break-all text-highlighted">{{ createdPlaintext }}</code>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="soft"
                  label="Copy"
                  icon="i-lucide-copy"
                  @click="copyText(createdPlaintext!, 'Token')"
                />
              </div>
            </template>
          </UAlert>

          <div
            v-if="tokensStatus === 'pending' && !tokensData"
            class="text-sm text-muted"
          >
            Loading tokens…
          </div>
          <ul
            v-else-if="tokensData?.tokens.length"
            class="divide-y divide-default rounded-lg border border-default"
          >
            <li
              v-for="row in tokensData.tokens"
              :key="row.id"
              class="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm"
            >
              <div class="min-w-0">
                <p class="font-medium text-highlighted truncate">
                  {{ row.name }}
                </p>
                <p class="text-xs text-muted font-mono truncate">
                  {{ row.tokenPrefix }}…
                  · created {{ fmt(row.createdAt) }}
                  · last used {{ fmt(row.lastUsedAt) }}
                </p>
              </div>
              <UButton
                size="xs"
                color="error"
                variant="ghost"
                label="Revoke"
                :loading="revokingId === row.id"
                :disabled="!!revokingId"
                @click="revokeToken(row)"
              />
            </li>
          </ul>
          <p
            v-else
            class="text-sm text-muted"
          >
            No tokens yet.
          </p>

          <pre class="rounded-lg bg-muted p-3 text-[11px] font-mono overflow-x-auto text-highlighted">Authorization: Bearer opina_pat_…
# Cursor / Claude MCP server URL:
{{ mcpUrl }}</pre>
        </section>

        <section class="rounded-lg border border-default p-4 bg-default space-y-3">
          <h2 class="font-medium text-highlighted">
            Backup status
          </h2>
          <dl class="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-muted">
                Last run
              </dt>
              <dd>{{ fmt(data.backup.lastRunAt) }}</dd>
            </div>
            <div>
              <dt class="text-muted">
                Result
              </dt>
              <dd>
                <span v-if="data.backup.lastOk === true">OK</span>
                <span v-else-if="data.backup.lastOk === false">Failed</span>
                <span v-else>—</span>
              </dd>
            </div>
            <div>
              <dt class="text-muted">
                Database backup
              </dt>
              <dd class="font-mono break-all text-xs">
                {{ data.backup.lastKey || '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">
                Screenshots backup
              </dt>
              <dd class="font-mono break-all text-xs">
                {{ data.backup.lastFilesKey || '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">
                Size
              </dt>
              <dd>{{ bytes(data.backup.lastBytes) }}</dd>
            </div>
            <div>
              <dt class="text-muted">
                Retention
              </dt>
              <dd>{{ data.backup.retention }} recent snapshots</dd>
            </div>
          </dl>
          <UAlert
            v-if="data.backup.lastError"
            color="error"
            variant="subtle"
            :title="data.backup.lastError"
          />
          <UButton
            label="Run backup now"
            icon="i-lucide-cloud-upload"
            :loading="pending"
            :disabled="!data.backup.enabled"
            @click="runNow"
          />
        </section>

        <section class="space-y-2 text-sm text-muted">
          <h2 class="font-medium text-highlighted">
            Restore
          </h2>
          <pre class="rounded-lg bg-muted p-4 text-xs font-mono overflow-x-auto text-highlighted">gunzip opina-….db.gz
docker compose stop opina
cp opina-….db ./data/opina.db
docker compose start opina</pre>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
