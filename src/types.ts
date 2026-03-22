export enum OverrideTarget {
  DESKTOP = 'Desktop',
  XBOX = 'Xbox',
  MOBILE = 'Mobile',
}

export enum OverrideType {
  CANCEL = 'Cancel',
  UNTIL = 'BlockUntil',
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user_id: string
}

export interface RosterResponse {
  members: RosterMember[]
}

export interface RosterMember {
  id: string
  role: string
  profilePicUrl: string
  isDigitalSafetyEnabled: boolean
  user: {
    firstName: string
    lastName: string
    accountPrimaryAlias: string
  }
}

export interface DevicesResponse {
  devices: DeviceData[]
}

export interface DeviceData {
  deviceId: string
  deviceName: string
  deviceClass: string
  deviceMake: string
  deviceModel: string
  deviceFormFactor: string
  osName: string
  issues: unknown
  states: unknown
  lastSeenOn: string
}

export interface ScreentimeUsageResponse {
  deviceUsageAggregates: {
    totalScreenTime: number
    dailyAverage: number
    deviceAggregates: Array<{
      deviceId: string
      timeUsed: number
    }>
  }
}

export interface AppUsageResponse {
  appActivity: AppActivityEntry[]
}

export interface AppActivityEntry {
  appId: string
  displayName: string
  iconUrl: string
  usage: number
  policy: string
  blockState: string
  isLegacyBlocked: boolean
}

export interface OverridesResponse {
  lockablePlatforms: LockablePlatform[]
}

export interface LockablePlatform {
  appliesTo: string
  overrides: unknown[]
  devices: Array<{ deviceId: string }>
}

export interface SpendingResponse {
  balances: Array<{
    balance: number
    currency: string
  }>
}

export interface PendingRequest {
  id: string
  puid: number
  type: string
  lockTime: string
  platform: string
  requestedTime: string
  appName?: string | null
  isGlobal?: boolean | null
}

export interface PendingRequestsResponse {
  pendingRequests: PendingRequest[]
}

// ─── Schedule / time limit types ─────────────────────────────────────────────

/** `"Windows"` | `"Xbox"` | `"Mobile"` | `"AllDevices"` */
export type SchedulePlatform = 'Windows' | 'Xbox' | 'Mobile' | 'AllDevices'

/** `"PerDeviceType"` (per platform) | `"Global"` (one schedule for all) */
export type ScheduleMode = 'PerDeviceType' | 'Global'

/** A single allowed time window, e.g. `{ begin: "07:00", end: "22:00" }` */
export interface TimeInterval {
  begin: string  // "HH:mm"
  end: string    // "HH:mm"
}

/**
 * Daily policy for a single day.
 * - `allowance`: total allowed screen time in **minutes** (0 = no limit set)
 * - `allottedIntervals`: time windows when the device is allowed (empty = no restriction)
 */
export interface DayPolicy {
  allowance: number  // minutes
  allottedIntervals: TimeInterval[]
}

/**
 * Weekly restrictions object.
 * Each day can be `null` (inherits from `everyday`) or a specific `DayPolicy`.
 * Set `everyday` to apply the same policy to all days.
 */
export interface WeeklySchedule {
  monday?: DayPolicy | null
  tuesday?: DayPolicy | null
  wednesday?: DayPolicy | null
  thursday?: DayPolicy | null
  friday?: DayPolicy | null
  saturday?: DayPolicy | null
  sunday?: DayPolicy | null
  everyday?: DayPolicy | null
}

/** One platform's schedule entry as returned by the API. */
export interface ScheduleEntry {
  enabled: boolean
  appliesTo: string       // platform key, e.g. "Windows"
  platformName: string    // display name, e.g. "Windows"
  dailyRestrictions: WeeklySchedule
  usage: number           // screen time used today (minutes)
}

/** Full response from `GET /v4/devicelimits/schedules/{userId}` */
export interface ScheduleResponse {
  mode: ScheduleMode
  schedules: ScheduleEntry[]
  effectiveActivityReportingState: string
}

/** Request body for `PUT /v4/devicelimits/schedules/{userId}` */
export interface UpdateScheduleRequest {
  dailyRestrictions: WeeklySchedule
  mode: ScheduleMode
  appliesTo?: SchedulePlatform
  culture?: string   // e.g. "pt-BR" — defaults to system locale
  time?: string      // ISO timestamp — defaults to now
}
