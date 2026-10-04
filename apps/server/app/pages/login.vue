<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const email = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)
const { fetch: refreshSession } = useUserSession()

async function onSubmit() {
  error.value = ''
  pending.value = true
  try {
    await $fetch('/api/admin/login', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value,
      },
    })
    await refreshSession()
    await navigateTo('/')
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, statusMessage?: string }
    error.value = err.data?.statusMessage || err.statusMessage || 'Login failed'
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
        Sign in
      </h1>
      <p class="text-muted">
        Access the Opina admin panel.
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
      >
        <UInput
          v-model="password"
          type="password"
          autocomplete="current-password"
          class="w-full"
          required
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
        label="Sign in"
      />
    </UForm>
  </div>
</template>
