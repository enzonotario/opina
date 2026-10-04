export async function requireAdminSession(event: Parameters<typeof requireUserSession>[0]) {
  return requireUserSession(event)
}
