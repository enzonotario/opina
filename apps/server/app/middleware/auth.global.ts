export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn } = useUserSession()
  const { data, refresh } = await useFetch('/api/admin/me', {
    key: 'admin-me',
  })

  // First /me stays cached as logged-out. Refresh when the session disagrees.
  if (loggedIn.value !== !!data.value?.user) {
    await refresh()
  }

  const isSetupRoute = to.path.startsWith('/setup/')
  const isInstallRoute = to.path === '/install'
  const isLoggedIn = loggedIn.value || !!data.value?.user

  if (data.value?.needsSetup) {
    if (isSetupRoute || isInstallRoute) return
    return navigateTo('/install')
  }

  if (isSetupRoute || isInstallRoute || to.path === '/setup') {
    return navigateTo(isLoggedIn ? '/' : '/login')
  }

  if (!isLoggedIn && to.path !== '/login') {
    return navigateTo('/login')
  }

  if (isLoggedIn && to.path === '/login') {
    return navigateTo('/')
  }
})
