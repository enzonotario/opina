import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { responseCreatedBody, signWebhookBody } from './webhook-payload'

describe('response webhooks', () => {
  it('builds a generic response.created event', () => {
    const body = responseCreatedBody('whk_test', {
      responseId: 'rsp_1',
      projectId: 'prj_1',
      projectName: 'Site',
      surveyId: 'srv_1',
      surveyName: 'NPS',
      score: 9,
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
      response: { id: 'rsp_1', projectName: 'Site', score: 9, comment: 'hola' },
    })
  })

  it('signs the exact body bytes', () => {
    const body = '{"event":"response.created"}'
    const expected = `sha256=${createHmac('sha256', 'secret-value-1234').update(body).digest('hex')}`
    expect(signWebhookBody('secret-value-1234', body)).toBe(expected)
  })
})
