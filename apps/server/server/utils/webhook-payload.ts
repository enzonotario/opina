import { createHmac } from 'node:crypto'
import { DEFAULT_HELPFUL_OPTIONS } from '../../shared/surveys'

export type ResponseWebhookInput = {
  responseId: string
  projectId: string
  projectName: string
  surveyId: string
  surveyName: string
  surveyType: string
  score: number | null
  answer: string | null
  comment: string | null
  path: string
  host: string
  locale: string | null
  device: string | null
  createdAt: number
}

type ChoiceOption = { value: number, label: Record<string, string> }

function pickLabel(label: Record<string, string>, locale: string) {
  return label[locale] || label.es || label.en || Object.values(label).find(Boolean) || ''
}

/** Texto de la opción elegida. Solo Page feedback (helpful) tiene etiquetas. */
export function responseAnswerLabel(input: {
  surveyType: string
  score: number | null
  locale: string | null
  fallbackLocale?: string
  options?: ChoiceOption[]
}): string | null {
  if (input.surveyType !== 'helpful' || input.score == null) return null
  const options = input.options?.length === 4 ? input.options : DEFAULT_HELPFUL_OPTIONS
  const chosen = options.find(option => option.value === input.score)
  if (!chosen) return null
  const locale = input.locale || input.fallbackLocale || 'es'
  const label = pickLabel(chosen.label, locale).trim()
  return label || null
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
      surveyType: input.surveyType,
      score: input.score,
      answer: input.answer,
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
