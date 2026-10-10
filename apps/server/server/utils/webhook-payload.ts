import { createHmac } from 'node:crypto'

export type ResponseWebhookInput = {
  responseId: string
  projectId: string
  projectName: string
  surveyId: string
  surveyName: string
  score: number | null
  comment: string | null
  path: string
  host: string
  locale: string | null
  device: string | null
  createdAt: number
}

export function responseCreatedBody(webhookId: string, input: ResponseWebhookInput) {
  return JSON.stringify({
    event: 'response.created',
    webhookId,
    response: {
      id: input.responseId,
      projectId: input.projectId,
      projectName: input.projectName,
      surveyId: input.surveyId,
      surveyName: input.surveyName,
      score: input.score,
      comment: input.comment,
      path: input.path,
      host: input.host,
      locale: input.locale,
      device: input.device,
      createdAt: input.createdAt,
    },
  })
}

export function signWebhookBody(secret: string, body: string) {
  const hex = createHmac('sha256', secret).update(body).digest('hex')
  return `sha256=${hex}`
}
