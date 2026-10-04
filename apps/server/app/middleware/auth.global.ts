export default defineNuxtRouteMiddleware(async (to) => {
  const { data } = await useFetch('/api/admin/me', {
    key: 'admin-me',
  })

  const isSetupRoute = to.path.startsWith('/setup/')
  const isInstallRoute = to.path === '/install'

  if (data.value?.needsSetup) {
    if (isSetupRoute || isInstallRoute) return
    return navigateTo('/install')
  }

  if (isSetupRoute || isInstallRoute || to.path === '/setup') {
    return navigateTo(data.value?.user ? '/' : '/login')
  }

  if (!data.value?.user && to.path !== '/login') {
    return navigateTo('/login')
  }

  if (data.value?.user && to.path === '/login') {
    return navigateTo('/')
  }
})
