import { eq } from 'drizzle-orm'
import * as v from 'valibot'
import { SetupBodySchema } from '../../../shared/auth'
import { users } from '../../db/schema'
import { useDb } from '../../db/client'
import { createId } from '../../utils/ids'
import {
  clearSetupToken,
  needsSetup,
  validateSetupToken,
} from '../../utils/setup-token'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, data =>
    v.parse(SetupBodySchema, data),
  )

  if (!needsSetup()) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Setup already completed',
    })
  }

  if (!validateSetupToken(body.token)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Invalid or expired setup token',
    })
  }

  const db = useDb()
  const existing = db
    .select()
    .from(users)
    .where(eq(users.email, body.email.toLowerCase()))
    .get()

  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Email already in use',
    })
  }

  const passwordHash = await hashPassword(body.password)
  const now = Date.now()
  const user = {
    id: createId('usr'),
    email: body.email.toLowerCase(),
    passwordHash,
    role: 'owner',
    createdAt: now,
  }

  db.insert(users).values(user).run()
  clearSetupToken()

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
