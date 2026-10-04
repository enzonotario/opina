import { needsSetup } from '../../utils/setup-token'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  return {
    needsSetup: needsSetup(),
    user: session.user ?? null,
  }
})
