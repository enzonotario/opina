import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { DEFAULT_HELPFUL_OPTIONS } from '../../shared/surveys'
import { responseAnswerLabel, responseCreatedBody, signWebhookBody } from './webhook-payload'

describe('response webhooks', () => {
  it('builds a generic response.created event', () => {
    const body = responseCreatedBody('whk_test', {
      responseId: 'rsp_1',
      projectId: 'prj_1',
      projectName: 'Site',
      surveyId: 'srv_1',
      surveyName: 'NPS',
      surveyType: 'nps',
      score: 9,
      answer: null,
      comment: 'hola',
      path: '/pricing',
      host: 'example.com',
      locale: 'es',
      device: 'desktop',
      createdAt: 10,
    })
    expect(JSON.parse(body)).toMatchObject({
      event: 'response.created',
      webhookId: 'whk_test',
      response: { id: 'rsp_1', projectName: 'Site', surveyType: 'nps', score: 9, answer: null, comment: 'hola' },
    })
  })

  it('labels the chosen page-feedback option', () => {
    expect(responseAnswerLabel({
      surveyType: 'helpful',
      score: 4,
      locale: 'es',
      options: DEFAULT_HELPFUL_OPTIONS,
    })).toBe('Muy útil')
    expect(responseAnswerLabel({
      surveyType: 'helpful',
      score: 1,
      locale: 'en',
    })).toBe('Confusing')
    expect(responseAnswerLabel({
      surveyType: 'helpful',
      score: 2,
      locale: 'fr',
      options: [
        { value: 4, label: { es: 'Muy útil' } },
        { value: 3, label: { es: 'Útil' } },
        { value: 2, label: { es: 'Regular' } },
        { value: 1, label: { es: 'Confuso' } },
      ],
    })).toBe('Regular')
    expect(responseAnswerLabel({
      surveyType: 'csat',
      score: 5,
      locale: 'es',
    })).toBeNull()
  })

  it('signs the exact body bytes', () => {
    const body = '{"event":"response.created"}'
    const expected = `sha256=${createHmac('sha256', 'secret-value-1234').update(body).digest('hex')}`
    expect(signWebhookBody('secret-value-1234', body)).toBe(expected)
  })
})
