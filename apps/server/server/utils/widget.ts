import { and, eq } from 'drizzle-orm'
import { projects, surveys } from '../db/schema'
import { useDb } from '../db/client'
import { parseJsonArray } from './projects'
import { toSurveyDto } from './surveys'
import type { SurveyDto } from '../../shared/surveys'

export type WidgetSurvey = {
  id: string
  type: string
  question: Record<string, string>
  followUp: Record<string, string> | null
  thanks: Record<string, string> | null
  appearance: SurveyDto['appearance']
  trigger: Record<string, unknown>
  targeting: SurveyDto['targeting']
  frequency: SurveyDto['frequency']
}

export function getProjectByPublicKey(key: string) {
  return useDb()
    .select()
    .from(projects)
    .where(eq(projects.publicKey, key))
    .get()
}

export function listActiveSurveys(projectId: string): WidgetSurvey[] {
  return useDb()
    .select()
    .from(surveys)
    .where(and(eq(surveys.projectId, projectId), eq(surveys.isActive, 1)))
    .all()
    .map((row) => {
      const dto = toSurveyDto(row)
      return {
        id: dto.id,
        type: dto.type,
        question: dto.question,
        followUp: dto.followUp,
        thanks: dto.thanks,
        appearance: dto.appearance,
        trigger: dto.trigger as Record<string, unknown>,
        targeting: dto.targeting,
        frequency: dto.frequency,
      }
    })
}

export function getActiveSurvey(projectId: string, surveyId: string) {
  return useDb()
    .select()
    .from(surveys)
    .where(and(
      eq(surveys.id, surveyId),
      eq(surveys.projectId, projectId),
      eq(surveys.isActive, 1),
    ))
    .get()
}

export function scoreRange(type: string): [number, number] | null {
  switch (type) {
    case 'csat': return [1, 5]
    case 'thumbs': return [0, 1]
    case 'helpful': return [1, 4]
    case 'nps': return [0, 10]
    case 'ces': return [1, 7]
    case 'text': return null
    default: return [1, 5]
  }
}

export function projectOrigins(project: { allowedOrigins: string }) {
  return parseJsonArray(project.allowedOrigins)
}
