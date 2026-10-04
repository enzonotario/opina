import * as v from 'valibot'

export const SetupBodySchema = v.object({
  token: v.pipe(v.string(), v.minLength(16), v.maxLength(128)),
  email: v.pipe(v.string(), v.email(), v.maxLength(254)),
  password: v.pipe(v.string(), v.minLength(8), v.maxLength(128)),
})

export const LoginBodySchema = v.object({
  email: v.pipe(v.string(), v.email(), v.maxLength(254)),
  password: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
})

export type SetupBody = v.InferOutput<typeof SetupBodySchema>
export type LoginBody = v.InferOutput<typeof LoginBodySchema>
