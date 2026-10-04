<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const route = useRoute()
const token = computed(() => String(route.params.token || ''))
const email = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)
const { fetch: refreshSession } = useUserSession()

const { data: me } = await useFetch('/api/admin/me')
if (!me.value?.needsSetup) {
  await navigateTo(me.value?.user ? '/' : '/login')
}

async function onSubmit() {
  error.value = ''
  pending.value = true
  try {
    await $fetch('/api/admin/setup', {
      method: 'POST',
      body: {
        token: token.value,
        email: email.value,
        password: password.value,
      },
    })
    await refreshSession()
    await navigateTo('/')
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, statusMessage?: string }
    error.value = err.data?.statusMessage || err.statusMessage || 'Setup failed'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md space-y-6">
    <div class="space-y-2">
      <p class="text-sm font-medium text-primary">
        Opina
      </p>
      <h1 class="text-2xl font-semibold text-highlighted">
        Create owner account
      </h1>
      <p class="text-muted">
        One-time install link. This creates the admin user for this instance.
      </p>
    </div>

    <UForm
      class="space-y-4"
      @submit.prevent="onSubmit"
    >
      <UFormField
        label="Email"
        name="email"
        required
      >
        <UInput
          v-model="email"
          type="email"
          autocomplete="username"
          class="w-full"
          required
        />
      </UFormField>
      <UFormField
        label="Password"
        name="password"
        required
        hint="At least 8 characters"
      >
        <UInput
          v-model="password"
          type="password"
          autocomplete="new-password"
          class="w-full"
          required
          minlength="8"
        />
      </UFormField>
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        :title="error"
      />
      <UButton
        type="submit"
        block
        :loading="pending"
        label="Create account"
      />
    </UForm>
  </div>
</template>
