import { createHash, randomBytes } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import { accessTokens } from '../db/schema'
import { useDb } from '../db/client'
import { createId } from './ids'

export type AccessTokenDto = {
  id: string
  name: string
  tokenPrefix: string
  createdAt: number
  lastUsedAt: number | null
}

export type CreatedAccessToken = AccessTokenDto & {
  /** Plaintext token — shown once at creation. */
  token: string
}

const TOKEN_BYTES = 24

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function toDto(row: typeof accessTokens.$inferSelect): AccessTokenDto {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt ?? null,
  }
}

export function listAccessTokens(): AccessTokenDto[] {
  return useDb()
    .select()
    .from(accessTokens)
    .orderBy(desc(accessTokens.createdAt))
    .all()
    .map(toDto)
}

export function createAccessToken(name: string): CreatedAccessToken {
  const trimmed = name.trim()
  if (!trimmed) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }
  if (trimmed.length > 80) {
    throw createError({ statusCode: 400, statusMessage: 'Name max length is 80' })
  }

  const secret = randomBytes(TOKEN_BYTES).toString('base64url')
  const token = `opina_pat_${secret}`
  const now = Date.now()
  const row = {
    id: createId('tok'),
    name: trimmed,
    tokenHash: hashToken(token),
    tokenPrefix: token.slice(0, 18),
    createdAt: now,
    lastUsedAt: null as number | null,
  }
  useDb().insert(accessTokens).values(row).run()
  return { ...toDto(row), token }
}

export function revokeAccessToken(id: string) {
  const row = useDb()
    .select({ id: accessTokens.id })
    .from(accessTokens)
    .where(eq(accessTokens.id, id))
    .get()
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Token not found' })
  }
  useDb().delete(accessTokens).where(eq(accessTokens.id, id)).run()
  return { ok: true as const }
}

/** Verify a Bearer PAT. Returns token metadata or null. */
export function verifyAccessToken(raw: string | null | undefined): AccessTokenDto | null {
  if (!raw) return null
  const token = raw.trim()
  if (!token.startsWith('opina_pat_')) return null

  const row = useDb()
    .select()
    .from(accessTokens)
    .where(eq(accessTokens.tokenHash, hashToken(token)))
    .get()

  if (!row) return null

  const now = Date.now()
  useDb()
    .update(accessTokens)
    .set({ lastUsedAt: now })
    .where(eq(accessTokens.id, row.id))
    .run()

  return { ...toDto(row), lastUsedAt: now }
}

export function requireAccessTokenFromHeader(authorization: string | undefined): AccessTokenDto {
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  const verified = verifyAccessToken(token)
  if (!verified) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or missing access token',
    })
  }
  return verified
}
