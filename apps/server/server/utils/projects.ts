import { eq } from 'drizzle-orm'
import type { ProjectDto } from '../../shared/projects'
import { projects, surveys } from '../db/schema'
import { useDb } from '../db/client'
import { createId } from './ids'

export function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

export function toProjectDto(row: typeof projects.$inferSelect): ProjectDto {
  return {
    id: row.id,
    name: row.name,
    publicKey: row.publicKey,
    allowedOrigins: parseJsonArray(row.allowedOrigins),
    settings: parseJsonObject(row.settings),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function getProjectOrThrow(id: string) {
  const row = useDb()
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .get()

  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Project not found',
    })
  }

  return row
}

export function createProject(input: {
  name: string
  allowedOrigins?: string[]
}) {
  const now = Date.now()
  const row = {
    id: createId('prj'),
    name: input.name,
    publicKey: createId('pk'),
    allowedOrigins: JSON.stringify(input.allowedOrigins || []),
    settings: '{}',
    createdAt: now,
    updatedAt: now,
  }
  const db = useDb()
  db.insert(projects).values(row).run()

  db.insert(surveys).values({
    id: createId('srv'),
    projectId: row.id,
    name: 'CSAT',
    type: 'csat',
    question: JSON.stringify({
      es: '¿Cómo calificarías tu satisfacción?',
      en: 'How would you rate your satisfaction?',
    }),
    followUp: JSON.stringify({
      es: 'Déjanos tu comentario sobre tu calificación',
      en: 'Leave a comment about your rating',
    }),
    thanks: JSON.stringify({
      es: '¡Gracias por tus comentarios!',
      en: 'Thanks for your feedback!',
    }),
    appearance: JSON.stringify({
      background: '#ffffff',
      button: '#16a34a',
      text: '#18181b',
      position: 'right',
      scaleStyle: 'emojis',
      lowLabel: { es: 'Muy insatisfecho', en: 'Very dissatisfied' },
      highLabel: { es: 'Muy satisfecho', en: 'Very satisfied' },
      locale: 'es',
    }),
    trigger: JSON.stringify({ type: 'manual' }),
    targeting: JSON.stringify({
      devices: ['desktop', 'tablet', 'mobile'],
      sampleRate: 100,
    }),
    frequency: JSON.stringify({ mode: 'once' }),
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  }).run()

  return toProjectDto(row)
}

export function listProjects() {
  return useDb()
    .select()
    .from(projects)
    .all()
    .map(toProjectDto)
    .sort((a, b) => b.createdAt - a.createdAt)
}
