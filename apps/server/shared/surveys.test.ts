import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { SurveyCreateSchema, SurveyUpdateSchema } from './surveys'

describe('SurveyCreateSchema', () => {
  it('accepts csat with delay trigger', () => {
    const parsed = v.safeParse(SurveyCreateSchema, {
      type: 'csat',
      question: { es: '¿Ok?', en: 'Ok?' },
      trigger: { type: 'delay', ms: 2500 },
      targeting: { include: ['/docs/**'], sampleRate: 50 },
      frequency: { mode: 'cooldown', days: 14 },
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts thumbs with defaults', () => {
    const parsed = v.safeParse(SurveyCreateSchema, {
      type: 'thumbs',
      question: { es: '¿Útil?' },
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.output.trigger).toEqual({ type: 'manual' })
      expect(parsed.output.frequency).toEqual({ mode: 'once' })
    }
  })

  it('accepts delay of 0ms (immediate-like)', () => {
    const parsed = v.safeParse(SurveyCreateSchema, {
      type: 'csat',
      question: { es: 'x' },
      trigger: { type: 'delay', ms: 0 },
      frequency: { mode: 'until_submit' },
    })
    expect(parsed.success).toBe(true)
  })
})

describe('SurveyUpdateSchema', () => {
  it('allows partial patch', () => {
    const parsed = v.safeParse(SurveyUpdateSchema, { isActive: false })
    expect(parsed.success).toBe(true)
  })
})
