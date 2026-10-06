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

  it('accepts helpful with options', () => {
    const parsed = v.safeParse(SurveyCreateSchema, {
      type: 'helpful',
      question: {
        es: '¿Te resultó útil?',
        en: 'Was this helpful?',
      },
      appearance: {
        imageUrl: 'https://cdn.example.com/logo.svg',
        options: [
          { value: 4, label: { es: 'Muy útil', en: 'Very helpful' } },
          { value: 3, label: { es: 'Útil', en: 'Helpful' } },
          { value: 2, label: { es: 'No útil', en: 'Not helpful' } },
          { value: 1, label: { es: 'Confuso', en: 'Confusing' } },
        ],
      },
      trigger: { type: 'manual' },
      frequency: { mode: 'once' },
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.output.type).toBe('helpful')
      expect(parsed.output.appearance?.options).toHaveLength(4)
      expect(parsed.output.appearance?.imageUrl).toBe('https://cdn.example.com/logo.svg')
    }
  })
})

describe('SurveyUpdateSchema', () => {
  it('allows partial patch', () => {
    const parsed = v.safeParse(SurveyUpdateSchema, { isActive: false })
    expect(parsed.success).toBe(true)
  })
})
