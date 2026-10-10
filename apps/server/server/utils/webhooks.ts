import { and, asc, eq } from 'drizzle-orm'
import type { WebhookDto } from '../../shared/webhooks'
import { webhooks } from '../db/schema'
import { useDb } from '../db/client'
import { createId } from './ids'
import { getProjectOrThrow } from './projects'
import {
  responseCreatedBody,
  signWebhookBody,
  type ResponseWebhookInput,
} from './webhook-payload'

type WebhookRow = typeof webhooks.$inferSelect

function toDto(row: WebhookRow): WebhookDto {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    url: row.url,
    enabled: row.enabled === 1,
    secretTail: row.secret.slice(-4),
    lastStatus: row.lastStatus,
    lastError: row.lastError,
    lastDeliveryAt: row.lastDeliveryAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function listWebhooks(projectId: string): WebhookDto[] {
  getProjectOrThrow(projectId)
  return useDb()
    .select()
    .from(webhooks)
    .where(eq(webhooks.projectId, projectId))
    .orderBy(asc(webhooks.createdAt))
    .all()
    .map(toDto)
}

export function createWebhook(projectId: string, input: { name: string, url: string, secret: string }) {
  getProjectOrThrow(projectId)
  const now = Date.now()
  const row: WebhookRow = {
    id: createId('whk'),
    projectId,
    name: input.name,
    url: input.url,
    secret: input.secret,
    enabled: 1,
    lastStatus: null,
    lastError: null,
    lastDeliveryAt: null,
    createdAt: now,
    updatedAt: now,
  }
  useDb().insert(webhooks).values(row).run()
  return toDto(row)
}

export function updateWebhook(
  projectId: string,
  webhookId: string,
  patch: { name?: string, url?: string, secret?: string, enabled?: boolean },
) {
  getProjectOrThrow(projectId)
  const existing = useDb()
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.projectId, projectId), eq(webhooks.id, webhookId)))
    .get()
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Webhook not found' })
  }
  const next = {
    name: patch.name ?? existing.name,
    url: patch.url ?? existing.url,
    secret: patch.secret ?? existing.secret,
    enabled: patch.enabled === undefined ? existing.enabled : (patch.enabled ? 1 : 0),
    updatedAt: Date.now(),
  }
  useDb().update(webhooks).set(next).where(eq(webhooks.id, webhookId)).run()
  return toDto({ ...existing, ...next })
}

export function deleteWebhook(projectId: string, webhookId: string) {
  getProjectOrThrow(projectId)
  const existing = useDb()
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(and(eq(webhooks.projectId, projectId), eq(webhooks.id, webhookId)))
    .get()
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Webhook not found' })
  }
  useDb().delete(webhooks).where(eq(webhooks.id, webhookId)).run()
}

async function deliverOne(row: WebhookRow, input: ResponseWebhookInput) {
  const body = responseCreatedBody(row.id, input)
  let status: number | null = null
  let error: string | null = null
  try {
    const response = await $fetch.raw(row.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${row.secret}`,
        'x-opina-event': 'response.created',
        'x-opina-signature': signWebhookBody(row.secret, body),
      },
      body,
      timeout: 4000,
    })
    status = response.status
    if (status < 200 || status >= 300) error = `HTTP ${status}`
  } catch (err: unknown) {
    const http = err && typeof err === 'object' && 'statusCode' in err
      ? Number((err as { statusCode?: number }).statusCode)
      : NaN
    status = Number.isFinite(http) ? http : null
    error = status ? `HTTP ${status}` : 'Delivery failed'
  }
  useDb().update(webhooks).set({
    lastStatus: status,
    lastError: error,
    lastDeliveryAt: Date.now(),
    updatedAt: Date.now(),
  }).where(eq(webhooks.id, row.id)).run()
}

export async function deliverResponseWebhooks(input: ResponseWebhookInput) {
  const rows = useDb()
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.projectId, input.projectId), eq(webhooks.enabled, 1)))
    .all()
  await Promise.all(rows.map(row => deliverOne(row, input)))
}
