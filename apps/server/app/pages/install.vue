<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { data } = await useFetch('/api/admin/me')

if (!data.value?.needsSetup) {
  await navigateTo(data.value?.user ? '/' : '/login')
}
</script>

<template>
  <div class="mx-auto max-w-lg space-y-6">
    <div class="space-y-2">
      <p class="text-sm font-medium text-primary">
        Opina
      </p>
      <h1 class="text-2xl font-semibold text-highlighted">
        Installation required
      </h1>
      <p class="text-muted">
        Open the one-time setup link from your server logs to create the first account.
      </p>
    </div>

    <UAlert
      color="info"
      variant="subtle"
      title="Find the setup link in the logs"
      description="It appears once when the app starts, and expires after 30 minutes."
    />
  </div>
</template>
