import { and, eq } from 'drizzle-orm'
import type {
  SurveyAppearance,
  SurveyCreate,
  SurveyDto,
  SurveyFrequency,
  SurveyTargeting,
  SurveyUpdate,
} from '../../shared/surveys'
import {
  DEFAULT_APPEARANCE,
  DEFAULT_HELPFUL_OPTIONS,
} from '../../shared/surveys'
import { surveys } from '../db/schema'
import { useDb } from '../db/client'
import { createId } from './ids'
import { getProjectOrThrow, parseJsonObject } from './projects'

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}

function normalizeOptions(raw: unknown): SurveyAppearance['options'] {
  if (!Array.isArray(raw) || raw.length !== 4) {
    return DEFAULT_HELPFUL_OPTIONS.map(o => ({
      value: o.value,
      label: { ...o.label },
    }))
  }
  const out: NonNullable<SurveyAppearance['options']> = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const value = typeof row.value === 'number' ? row.value : Number(row.value)
    if (!Number.isFinite(value) || value < 1 || value > 4) continue
    const label = asRecord(row.label)
    if (!Object.keys(label).length) continue
    out.push({ value, label })
  }
  if (out.length !== 4) {
    return DEFAULT_HELPFUL_OPTIONS.map(o => ({
      value: o.value,
      label: { ...o.label },
    }))
  }
  return out.sort((a, b) => b.value - a.value)
}

function normalizeAppearance(raw: Record<string, unknown>): SurveyAppearance {
  const low = asRecord(raw.lowLabel)
  const high = asRecord(raw.highLabel)
  return {
    background: typeof raw.background === 'string' ? raw.background : DEFAULT_APPEARANCE.background,
    button: typeof raw.button === 'string' ? raw.button : DEFAULT_APPEARANCE.button,
    text: typeof raw.text === 'string' ? raw.text : DEFAULT_APPEARANCE.text,
    position: raw.position === 'left' ? 'left' : 'right',
    scaleStyle: raw.scaleStyle === 'numbers' || raw.scaleStyle === 'stars'
      ? raw.scaleStyle
      : 'emojis',
    lowLabel: Object.keys(low).length ? low : { ...DEFAULT_APPEARANCE.lowLabel },
    highLabel: Object.keys(high).length ? high : { ...DEFAULT_APPEARANCE.highLabel },
    options: normalizeOptions(raw.options),
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl.trim() : '',
    locale: typeof raw.locale === 'string' ? raw.locale : 'es',
    includeScreenshot: raw.includeScreenshot === true,
  }
}

function normalizeFrequency(raw: Record<string, unknown>): SurveyFrequency {
  const mode = String(raw.mode || '')
  if (mode === 'until_submit') return { mode: 'until_submit' }
  if (mode === 'always') return { mode: 'always' }
  if (mode === 'cooldown') {
    return { mode: 'cooldown', days: typeof raw.days === 'number' ? raw.days : 30 }
  }
  if (typeof raw.days === 'number') {
    return raw.days === 0
      ? { mode: 'always' }
      : { mode: 'cooldown', days: raw.days }
  }
  return { mode: 'once' }
}

function normalizeTargeting(raw: Record<string, unknown>): SurveyTargeting {
  const devices = Array.isArray(raw.devices)
    ? raw.devices.map(String).filter((d): d is 'desktop' | 'tablet' | 'mobile' =>
        d === 'desktop' || d === 'tablet' || d === 'mobile')
    : ['desktop', 'tablet', 'mobile']
  return {
    include: Array.isArray(raw.include) ? raw.include.map(String) : [],
    exclude: Array.isArray(raw.exclude) ? raw.exclude.map(String) : [],
    sampleRate: typeof raw.sampleRate === 'number' ? raw.sampleRate : 100,
    devices: devices.length ? devices : ['desktop', 'tablet', 'mobile'],
  }
}

export function toSurveyDto(row: typeof surveys.$inferSelect): SurveyDto {
  const trigger = parseJsonObject(row.trigger)
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name || 'Survey',
    type: row.type as SurveyDto['type'],
    question: asRecord(parseJsonObject(row.question)),
    followUp: row.followUp ? asRecord(parseJsonObject(row.followUp)) : null,
    thanks: row.thanks ? asRecord(parseJsonObject(row.thanks)) : null,
    appearance: normalizeAppearance(parseJsonObject(row.appearance || '{}')),
    trigger: (trigger.type
      ? trigger
      : { type: 'manual' }) as SurveyDto['trigger'],
    targeting: normalizeTargeting(parseJsonObject(row.targeting)),
    frequency: normalizeFrequency(parseJsonObject(row.frequency)),
    isActive: row.isActive === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function listSurveys(projectId: string) {
  getProjectOrThrow(projectId)
  return useDb()
    .select()
    .from(surveys)
    .where(eq(surveys.projectId, projectId))
    .all()
    .map(toSurveyDto)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getSurveyOrThrow(projectId: string, surveyId: string) {
  const row = useDb()
    .select()
    .from(surveys)
    .where(and(eq(surveys.id, surveyId), eq(surveys.projectId, projectId)))
    .get()

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Survey not found' })
  }
  return row
}

export function createSurvey(projectId: string, input: SurveyCreate) {
  getProjectOrThrow(projectId)
  const now = Date.now()
  const row = {
    id: createId('srv'),
    projectId,
    name: input.name || 'Survey',
    type: input.type,
    question: JSON.stringify(input.question),
    followUp: input.followUp ? JSON.stringify(input.followUp) : null,
    thanks: input.thanks ? JSON.stringify(input.thanks) : null,
    appearance: JSON.stringify({ ...DEFAULT_APPEARANCE, ...input.appearance }),
    trigger: JSON.stringify(input.trigger || { type: 'manual' }),
    targeting: JSON.stringify(input.targeting || {}),
    frequency: JSON.stringify(input.frequency || { mode: 'once' }),
    isActive: input.isActive === false ? 0 : 1,
    createdAt: now,
    updatedAt: now,
  }
  useDb().insert(surveys).values(row).run()
  return toSurveyDto(row as typeof surveys.$inferSelect)
}

export function updateSurvey(projectId: string, surveyId: string, input: SurveyUpdate) {
  const existing = getSurveyOrThrow(projectId, surveyId)
  const patch: Partial<typeof surveys.$inferInsert> = {
    updatedAt: Date.now(),
  }
  if (input.name !== undefined) patch.name = input.name
  if (input.type !== undefined) patch.type = input.type
  if (input.question !== undefined) patch.question = JSON.stringify(input.question)
  if (input.followUp !== undefined) {
    patch.followUp = input.followUp ? JSON.stringify(input.followUp) : null
  }
  if (input.thanks !== undefined) {
    patch.thanks = input.thanks ? JSON.stringify(input.thanks) : null
  }
  if (input.appearance !== undefined) patch.appearance = JSON.stringify(input.appearance)
  if (input.trigger !== undefined) patch.trigger = JSON.stringify(input.trigger)
  if (input.targeting !== undefined) patch.targeting = JSON.stringify(input.targeting)
  if (input.frequency !== undefined) patch.frequency = JSON.stringify(input.frequency)
  if (input.isActive !== undefined) patch.isActive = input.isActive ? 1 : 0

  useDb().update(surveys).set(patch).where(eq(surveys.id, existing.id)).run()
  return toSurveyDto(getSurveyOrThrow(projectId, surveyId))
}

export function deleteSurvey(projectId: string, surveyId: string) {
  getSurveyOrThrow(projectId, surveyId)
  useDb().delete(surveys).where(eq(surveys.id, surveyId)).run()
  return { ok: true as const }
}
