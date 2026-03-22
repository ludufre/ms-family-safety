import { FamilySafetyAPI } from './api.js'
import { Authenticator } from './authenticator.js'
import { Account } from './account.js'
import { Device } from './device.js'
import { Application } from './application.js'
import { AggregatorError } from './errors.js'
import { OverrideTarget, OverrideType } from './types.js'
import type {
  RosterResponse,
  RosterMember,
  PendingRequestsResponse,
  PendingRequest,
  DevicesResponse,
  ScreentimeUsageResponse,
  AppUsageResponse,
  ScheduleResponse,
  ScheduleEntry,
  WeeklySchedule,
  DayPolicy,
  SchedulePlatform,
  ScheduleMode,
  UpdateScheduleRequest,
} from './types.js'

export interface Credentials {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

function todayRange(): { beginTime: string; endTime: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const offsetMin = -now.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const absMin = Math.abs(offsetMin)
  const tz = `${sign}${pad(Math.floor(absMin / 60))}:${pad(absMin % 60)}`
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return {
    beginTime: `${date}T00:00:00${tz}`,
    endTime: `${date}T23:59:59${tz}`,
  }
}

export class FamilySafety {
  private _api: FamilySafetyAPI
  private _auth: Authenticator

  /** Populated after calling `update()` — not needed for direct method calls. */
  accounts: Account[] = []
  pendingRequests: PendingRequest[] = []

  constructor(auth: Authenticator) {
    this._auth = auth
    this._api = new FamilySafetyAPI(auth)
  }

  /** Current token state — persist this after operations to avoid unnecessary refreshes. */
  get credentials(): Credentials {
    return {
      accessToken: this._auth.rawAccessToken ?? '',
      refreshToken: this._auth.refreshToken ?? '',
      expiresAt: this._auth.expiresAt,
    }
  }

  /**
   * Create from a redirect URL (first login) or a raw refresh token string.
   *
   * @param token - Redirect URL after OAuth login, or a refresh token string
   * @param useRefreshToken - Pass `true` when `token` is a refresh token
   */
  static async create(token: string, useRefreshToken = false): Promise<FamilySafety> {
    const auth = await Authenticator.create(token, useRefreshToken)
    return new FamilySafety(auth)
  }

  /**
   * Create from previously saved credentials.
   * Uses the access token directly if still valid; refreshes only when expired.
   */
  static fromSaved(credentials: Credentials): FamilySafety {
    const auth = Authenticator.fromSaved(
      credentials.accessToken,
      credentials.refreshToken,
      credentials.expiresAt,
    )
    return new FamilySafety(auth)
  }

  // ---------------------------------------------------------------------------
  // Accounts
  // ---------------------------------------------------------------------------

  /** Fetch the family roster. Returns members with `isDigitalSafetyEnabled`. */
  async getAccounts(): Promise<RosterMember[]> {
    const res = await this._api.getAccounts()
    const data = res.json as RosterResponse
    return (data.members ?? []).filter((m) => m.isDigitalSafetyEnabled)
  }

  // ---------------------------------------------------------------------------
  // Devices
  // ---------------------------------------------------------------------------

  /** Fetch devices for a user, with today's screen time filled in. */
  async getDevices(userId: string): Promise<Device[]> {
    const { beginTime, endTime } = todayRange()
    const [devicesRes, screentimeRes] = await Promise.all([
      this._api.getUserDevices(userId),
      this._api.getUserDeviceScreentimeUsage(userId, beginTime, endTime),
    ])
    return Device.fromResponse(
      devicesRes.json as DevicesResponse,
      screentimeRes.json as ScreentimeUsageResponse,
    )
  }

  // ---------------------------------------------------------------------------
  // Applications
  // ---------------------------------------------------------------------------

  /** Fetch apps used today by a user. */
  async getApps(userId: string): Promise<Application[]> {
    const { beginTime, endTime } = todayRange()
    const res = await this._api.getUserAppScreentimeUsage(userId, beginTime, endTime)
    return Application.fromResponse(res.json as AppUsageResponse, this._api, userId)
  }

  /** Block an application for a user. */
  async blockApp(userId: string, appId: string): Promise<void> {
    await this._api.setAppPolicy(
      userId,
      appId,
      {
        appId,
        appTimeEnforcementPolicy: 'WeekendAndWeekday',
        blockState: 'BlockedAlways',
        blocked: false,
        displayName: appId,
        enabled: true,
      },
      getAppPlatform(appId),
    )
  }

  /** Unblock an application for a user. */
  async unblockApp(userId: string, appId: string): Promise<void> {
    await this._api.setAppPolicy(
      userId,
      appId,
      {
        appId,
        appTimeEnforcementPolicy: 'WeekendAndWeekday',
        blockState: 'NotBlocked',
        blocked: false,
        displayName: appId,
        enabled: true,
      },
      getAppPlatform(appId),
    )
  }

  // ---------------------------------------------------------------------------
  // Device overrides (block/unblock by platform)
  // ---------------------------------------------------------------------------

  /** Block a device platform until the given date-time. */
  async blockDevice(userId: string, target: OverrideTarget, until: Date): Promise<void> {
    await this._api.overrideDeviceRestriction(userId, {
      overrideType: OverrideType.UNTIL,
      target,
      validUntil: until.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    })
  }

  /** Cancel an active device block for a platform. */
  async unblockDevice(userId: string, target: OverrideTarget): Promise<void> {
    await this._api.overrideDeviceRestriction(userId, {
      overrideType: OverrideType.CANCEL,
      target,
      validUntil: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    })
  }

  // ---------------------------------------------------------------------------
  // Schedule (daily time limits & allowed hours)
  // ---------------------------------------------------------------------------

  /**
   * Get the current screen time schedule for a user.
   *
   * @param userId - The user's ID
   * @param platform - Filter by platform: `"Windows"`, `"Xbox"`, `"Mobile"`, `"AllDevices"` (default: all)
   * @returns Full schedule response with mode and one entry per platform
   */
  async getSchedule(userId: string, platform?: SchedulePlatform): Promise<ScheduleResponse> {
    const res = await this._api.getSchedule(userId, platform)
    return scheduleToMinutes(res.json as ScheduleResponse)
  }

  /**
   * Update the screen time schedule for a user.
   *
   * Allowance values are in **minutes** (e.g. 4 hours = `240`).
   * Time intervals use `"HH:mm"` format (e.g. `"07:00"` to `"22:00"`).
   *
   * @param userId - The user's ID
   * @param schedule - Weekly restrictions to apply
   * @param platform - Target platform (`"Windows"`, `"Xbox"`, `"Mobile"`, `"AllDevices"`)
   * @param mode - `"PerDeviceType"` (separate schedule per platform) or `"Global"` (one for all)
   *
   * @example
   * // Limit desktop to 2h/day on weekdays, 4h on weekends, allowed 7am–10pm
   * await fs.updateSchedule(userId, {
   *   monday:    { allowance: 120, allottedIntervals: [{ begin: '07:00', end: '22:00' }] },
   *   tuesday:   { allowance: 120, allottedIntervals: [{ begin: '07:00', end: '22:00' }] },
   *   wednesday: { allowance: 120, allottedIntervals: [{ begin: '07:00', end: '22:00' }] },
   *   thursday:  { allowance: 120, allottedIntervals: [{ begin: '07:00', end: '22:00' }] },
   *   friday:    { allowance: 120, allottedIntervals: [{ begin: '07:00', end: '22:00' }] },
   *   saturday:  { allowance: 240, allottedIntervals: [{ begin: '07:00', end: '22:00' }] },
   *   sunday:    { allowance: 240, allottedIntervals: [{ begin: '07:00', end: '22:00' }] },
   * }, 'Windows')
   */
  async updateSchedule(
    userId: string,
    schedule: WeeklySchedule,
    platform?: SchedulePlatform,
    mode: ScheduleMode = 'PerDeviceType',
  ): Promise<ScheduleResponse> {
    const now = new Date()
    const offsetMin = -now.getTimezoneOffset()
    const sign = offsetMin >= 0 ? '+' : '-'
    const pad = (n: number) => String(Math.abs(n)).padStart(2, '0')
    const tz = `${sign}${pad(Math.floor(Math.abs(offsetMin) / 60))}:${pad(Math.abs(offsetMin) % 60)}`
    const time = now.toISOString().replace(/\.\d{3}Z$/, tz)
    const culture = Intl.DateTimeFormat().resolvedOptions().locale.replace('_', '-')

    const body: UpdateScheduleRequest = {
      dailyRestrictions: weeklyToMs(schedule),
      mode,
      appliesTo: platform,
      culture,
      time,
    }

    const res = await this._api.updateSchedule(userId, body, platform)
    return scheduleToMinutes(res.json as ScheduleResponse)
  }

  // ---------------------------------------------------------------------------
  // Pending requests
  // ---------------------------------------------------------------------------

  /** Fetch pending screen-time extension requests. */
  async getPendingRequests(): Promise<PendingRequest[]> {
    const res = await this._api.getPendingRequests()
    const data = res.json as PendingRequestsResponse
    return (data?.pendingRequests ?? []).filter((r) => r.type === 'DeviceScreenTime')
  }

  /**
   * Approve a pending screen-time request and grant an extension.
   *
   * @param puid - The user's PUID (from `getAccounts()`)
   * @param extensionMinutes - Extension to grant in **minutes** (e.g. 60 = 1 hour)
   */
  async approvePendingRequest(puid: number, extensionMinutes: number): Promise<boolean> {
    const requests = await this.getPendingRequests()
    const request = requests.find((r) => r.puid === puid)
    if (!request) throw new Error(`No pending request found for user ${puid}`)
    const res = await this._api.approvePendingRequest(request.puid, {
      type: request.type,
      id: request.id,
      request: {
        appId: request.id,
        lockTime: request.lockTime,
        appName: request.appName ?? null,
        extension: extensionMinutes * 60000,
        platform: request.platform,
        isGlobal: request.isGlobal ?? null,
        requestedTime: request.requestedTime,
      },
    })
    return res.status === 204
  }

  /** Deny a pending screen-time request. */
  async denyPendingRequest(puid: number): Promise<boolean> {
    const requests = await this.getPendingRequests()
    const request = requests.find((r) => r.puid === puid)
    if (!request) throw new Error(`No pending request found for user ${puid}`)
    const res = await this._api.denyPendingRequest(request.puid, {
      type: request.type,
      id: request.id,
      request: {
        appId: request.id,
        lockTime: request.lockTime,
        appName: request.appName ?? null,
        extension: null,
        platform: request.platform,
        isGlobal: request.isGlobal ?? null,
        requestedTime: request.requestedTime,
      },
    })
    return res.status === 204
  }

  // ---------------------------------------------------------------------------
  // Polling / Home Assistant style (loads everything eagerly)
  // ---------------------------------------------------------------------------

  /**
   * Fetch and populate `this.accounts` with full device, app, and screentime data.
   * Useful for polling scenarios (e.g. Home Assistant). Not needed for direct method calls.
   */
  async update(): Promise<void> {
    try {
      if (this.accounts.length === 0) {
        const res = await this._api.getAccounts()
        const data = res.json as RosterResponse
        this.accounts = await Account.fromRoster(data.members ?? [], this._api)
      } else {
        await Promise.all(this.accounts.map((a) => a.update()))
      }
    } catch (err) {
      if (err instanceof AggregatorError) {
        console.warn('Aggregator error occurred, skipping update.')
        return
      }
      throw err
    }
  }
}

function getAppPlatform(appId: string): string | undefined {
  if (appId.startsWith('x:')) return 'XBOX'
  if (appId.startsWith('appx:')) return 'WINDOWS'
  if (appId.startsWith('a:')) return 'MOBILE'
  return undefined
}

// ─── Schedule unit conversion helpers (API uses ms, library uses minutes) ────

function dayToMs(day: DayPolicy | null | undefined): DayPolicy | null | undefined {
  if (!day) return day
  return { ...day, allowance: day.allowance * 60000 }
}

function weeklyToMs(w: WeeklySchedule): WeeklySchedule {
  return {
    monday: dayToMs(w.monday),
    tuesday: dayToMs(w.tuesday),
    wednesday: dayToMs(w.wednesday),
    thursday: dayToMs(w.thursday),
    friday: dayToMs(w.friday),
    saturday: dayToMs(w.saturday),
    sunday: dayToMs(w.sunday),
    everyday: dayToMs(w.everyday),
  }
}

function dayToMinutes(day: DayPolicy | null | undefined): DayPolicy | null | undefined {
  if (!day) return day
  return { ...day, allowance: Math.round(day.allowance / 60000) }
}

function weeklyToMinutes(w: WeeklySchedule): WeeklySchedule {
  return {
    monday: dayToMinutes(w.monday),
    tuesday: dayToMinutes(w.tuesday),
    wednesday: dayToMinutes(w.wednesday),
    thursday: dayToMinutes(w.thursday),
    friday: dayToMinutes(w.friday),
    saturday: dayToMinutes(w.saturday),
    sunday: dayToMinutes(w.sunday),
    everyday: dayToMinutes(w.everyday),
  }
}

function scheduleToMinutes(response: ScheduleResponse): ScheduleResponse {
  return {
    ...response,
    schedules: response.schedules?.map((entry) => ({
      ...entry,
      usage: Math.round(entry.usage / 60000),
      dailyRestrictions: weeklyToMinutes(entry.dailyRestrictions),
    })) ?? [],
  }
}
