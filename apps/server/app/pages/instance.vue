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

const toast = useToast()
const { data, refresh, status } = await useFetch<{ backup: BackupStatus }>('/api/admin/backup/status')
const pending = ref(false)

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
