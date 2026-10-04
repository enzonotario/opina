import * as v from 'valibot'

export const OriginSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(512),
  v.check(
    (value) => {
      try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:'
      } catch {
        return false
      }
    },
    'Origin must be a valid http(s) URL',
  ),
)

export const ProjectCreateSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  allowedOrigins: v.optional(v.pipe(v.array(OriginSchema), v.maxLength(50)), []),
})

export const ProjectUpdateSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120))),
  allowedOrigins: v.optional(v.pipe(v.array(OriginSchema), v.maxLength(50))),
  settings: v.optional(v.record(v.string(), v.unknown())),
})

export type ProjectCreate = v.InferOutput<typeof ProjectCreateSchema>
export type ProjectUpdate = v.InferOutput<typeof ProjectUpdateSchema>

export type ProjectDto = {
  id: string
  name: string
  publicKey: string
  allowedOrigins: string[]
  settings: Record<string, unknown>
  createdAt: number
  updatedAt: number
}
