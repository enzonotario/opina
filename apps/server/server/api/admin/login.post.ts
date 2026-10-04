import { eq } from 'drizzle-orm'
import * as v from 'valibot'
import { LoginBodySchema } from '../../../shared/auth'
import { users } from '../../db/schema'
import { useDb } from '../../db/client'
import { consumeLoginRateLimit } from '../../utils/rate-limit'
import { clientIp } from '../../utils/request-ip'

export default defineEventHandler(async (event) => {
  const ip = clientIp(event)
  if (!consumeLoginRateLimit(ip)) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many login attempts. Try again in a minute.',
    })
  }

  const body = await readValidatedBody(event, data =>
    v.parse(LoginBodySchema, data),
  )

  const db = useDb()
  const user = db
    .select()
    .from(users)
    .where(eq(users.email, body.email.toLowerCase()))
    .get()

  if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid email or password',
    })
  }

  const now = Date.now()
  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    loggedInAt: now,
  })

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  }
})
