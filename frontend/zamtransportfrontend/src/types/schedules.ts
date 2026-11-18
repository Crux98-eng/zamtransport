export const scheduleDays = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const

export type ScheduleDayName = typeof scheduleDays[number]
export type ScheduleStatus = 'ACTIVE' | 'INACTIVE'

export type ScheduleRoute = {
  id: number
  name: string
  routeCode: string | null
  origin: string
  destination: string
  status: ScheduleStatus
}

export type Schedule = {
  id: number
  routeId: number
  description: string | null
  departureTime: string
  estimatedDuration: number
  effectiveFrom: string
  effectiveUntil: string | null
  status: ScheduleStatus
  route: ScheduleRoute
  days: Array<{ id: number; dayOfWeek: ScheduleDayName }>
  _count?: { trips: number }
}

export type SchedulePayload = {
  routeId: number
  description: string | null
  departureTime: string
  estimatedDuration: number
  effectiveFrom: string
  effectiveUntil: string | null
  days: ScheduleDayName[]
}

export type ScheduleGenerationResult = {
  schedulesProcessed: number
  generated: number
  skippedDuplicates: number
}
