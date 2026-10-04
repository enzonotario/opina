import * as v from 'valibot'

export const SurveyTypeSchema = v.picklist(['csat', 'thumbs', 'nps', 'ces', 'text'])

export const I18nTextSchema = v.pipe(
  v.record(v.string(), v.pipe(v.string(), v.maxLength(500))),
  v.check(obj => Object.keys(obj).length > 0, 'At least one locale is required'),
)

export const TriggerSchema = v.variant('type', [
  v.object({ type: v.literal('manual') }),
  v.object({ type: v.literal('immediate') }),
  v.object({
    type: v.literal('delay'),
    ms: v.pipe(v.number(), v.minValue(0), v.maxValue(120_000)),
  }),
  v.object({
    type: v.literal('scroll'),
    percent: v.pipe(v.number(), v.minValue(1), v.maxValue(100)),
  }),
  v.object({ type: v.literal('exit_intent') }),
  v.object({
    type: v.literal('pageviews'),
    count: v.pipe(v.number(), v.minValue(1), v.maxValue(100)),
  }),
])

export const DeviceSchema = v.picklist(['desktop', 'tablet', 'mobile'])

export const TargetingSchema = v.object({
  include: v.optional(v.array(v.pipe(v.string(), v.maxLength(200))), []),
  exclude: v.optional(v.array(v.pipe(v.string(), v.maxLength(200))), []),
  sampleRate: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(100)), 100),
  devices: v.optional(v.array(DeviceSchema), ['desktop', 'tablet', 'mobile']),
})

export const FrequencySchema = v.variant('mode', [
  v.object({ mode: v.literal('until_submit') }),
  v.object({ mode: v.literal('once') }),
  v.object({ mode: v.literal('always') }),
  v.object({
    mode: v.literal('cooldown'),
    days: v.pipe(v.number(), v.minValue(1), v.maxValue(3650)),
  }),
])

export const AppearanceSchema = v.object({
  background: v.optional(v.pipe(v.string(), v.maxLength(32)), '#ffffff'),
  button: v.optional(v.pipe(v.string(), v.maxLength(32)), '#16a34a'),
  text: v.optional(v.pipe(v.string(), v.maxLength(32)), '#18181b'),
  position: v.optional(v.picklist(['left', 'right']), 'right'),
  scaleStyle: v.optional(v.picklist(['emojis', 'numbers', 'stars']), 'emojis'),
  lowLabel: v.optional(I18nTextSchema, { es: 'Muy insatisfecho', en: 'Very dissatisfied' }),
  highLabel: v.optional(I18nTextSchema, { es: 'Muy satisfecho', en: 'Very satisfied' }),
  locale: v.optional(v.pipe(v.string(), v.maxLength(16)), 'es'),
  includeScreenshot: v.optional(v.boolean(), false),
})

export const SurveyCreateSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)), 'Survey'),
  type: SurveyTypeSchema,
  question: I18nTextSchema,
  followUp: v.optional(v.nullable(I18nTextSchema)),
  thanks: v.optional(v.nullable(I18nTextSchema)),
  appearance: v.optional(AppearanceSchema, {}),
  trigger: v.optional(TriggerSchema, { type: 'manual' }),
  targeting: v.optional(TargetingSchema, {}),
  frequency: v.optional(FrequencySchema, { mode: 'once' }),
  isActive: v.optional(v.boolean(), true),
})

export const SurveyUpdateSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120))),
  type: v.optional(SurveyTypeSchema),
  question: v.optional(I18nTextSchema),
  followUp: v.optional(v.nullable(I18nTextSchema)),
  thanks: v.optional(v.nullable(I18nTextSchema)),
  appearance: v.optional(AppearanceSchema),
  trigger: v.optional(TriggerSchema),
  targeting: v.optional(TargetingSchema),
  frequency: v.optional(FrequencySchema),
  isActive: v.optional(v.boolean()),
})

export type SurveyCreate = v.InferOutput<typeof SurveyCreateSchema>
export type SurveyUpdate = v.InferOutput<typeof SurveyUpdateSchema>
export type SurveyType = v.InferOutput<typeof SurveyTypeSchema>
export type SurveyAppearance = v.InferOutput<typeof AppearanceSchema>
export type SurveyFrequency = v.InferOutput<typeof FrequencySchema>
export type SurveyTrigger = v.InferOutput<typeof TriggerSchema>
export type SurveyTargeting = v.InferOutput<typeof TargetingSchema>

export const DEFAULT_APPEARANCE: SurveyAppearance = {
  background: '#ffffff',
  button: '#16a34a',
  text: '#18181b',
  position: 'right',
  scaleStyle: 'emojis',
  lowLabel: { es: 'Muy insatisfecho', en: 'Very dissatisfied' },
  highLabel: { es: 'Muy satisfecho', en: 'Very satisfied' },
  locale: 'es',
  includeScreenshot: false,
}

export type SurveyDto = {
  id: string
  projectId: string
  name: string
  type: SurveyType
  question: Record<string, string>
  followUp: Record<string, string> | null
  thanks: Record<string, string> | null
  appearance: SurveyAppearance
  trigger: SurveyTrigger
  targeting: SurveyTargeting
  frequency: SurveyFrequency
  isActive: boolean
  createdAt: number
  updatedAt: number
}
