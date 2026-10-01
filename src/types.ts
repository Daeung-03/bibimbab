export interface Participant {
  name: string
  ingredient: string
}

export interface Report {
  evaluation: string
  score: number
  mvp: string
  riskyCombination: string
}

export type RoomPhase = 'waiting' | 'shopping' | 'completed'

export interface RoomMember {
  id: string
  name: string
  isHost: boolean
  hasIngredient: boolean
  ingredient: string | null
}

export interface RoomView {
  id: string
  title: string
  phase: RoomPhase
  expiresAt: number
  members: RoomMember[]
  me: { id: string; isHost: boolean; missionIndex: number | null } | null
  report: Report | null
  generating: boolean
}

export interface RoomSession {
  token: string
}

export function isReport(value: unknown): value is Report {
  if (!value || typeof value !== 'object') return false
  const report = value as Record<string, unknown>
  return ['evaluation', 'mvp', 'riskyCombination'].every(
    (key) => typeof report[key] === 'string' && (report[key] as string).length > 0 && (report[key] as string).length <= 300,
  ) && typeof report.score === 'number' && Number.isInteger(report.score) && report.score >= 0 && report.score <= 100
}
