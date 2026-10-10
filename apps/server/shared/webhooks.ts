import * as v from 'valibot'

const WebhookUrlSchema = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(500),
  v.check((value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }, 'URL must be http or https'),
)

export const WebhookCreateSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
  url: WebhookUrlSchema,
  secret: v.pipe(v.string(), v.minLength(16), v.maxLength(200)),
})

export const WebhookPatchSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80))),
  url: v.optional(WebhookUrlSchema),
  secret: v.optional(v.pipe(v.string(), v.minLength(16), v.maxLength(200))),
  enabled: v.optional(v.boolean()),
})

export type WebhookDto = {
  id: string
  projectId: string
  name: string
  url: string
  enabled: boolean
  secretTail: string
  lastStatus: number | null
  lastError: string | null
  lastDeliveryAt: number | null
  createdAt: number
  updatedAt: number
}
