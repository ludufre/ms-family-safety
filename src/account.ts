import type { FamilySafetyAPI } from './api.js'
import { Device } from './device.js'
import { Application } from './application.js'
import { OverrideTarget, OverrideType } from './types.js'
import type {
  RosterMember,
  DevicesResponse,
  ScreentimeUsageResponse,
  AppUsageResponse,
  OverridesResponse,
  SpendingResponse,
} from './types.js'

function formatLocalISO(date: Date): string {
  const offsetMin = -date.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const absMin = Math.abs(offsetMin)
  const hh = String(Math.floor(absMin / 60)).padStart(2, '0')
  const mm = String(absMin % 60).padStart(2, '0')
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${hh}:${mm}`
  )
}

function todayRange(): { beginTime: string; endTime: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  return {
    beginTime: formatLocalISO(start),
    endTime: formatLocalISO(end),
  }
}

export class Account {
  userId: string
  role: string
  profilePicture: string
  firstName: string
  surname: string
  devices: Device[] = []
  applications: Application[] = []
  todayScreentimeUsage: number | null = null
  averageScreentimeUsage: number | null = null
  accountBalance = 0
  accountCurrency = ''
  blockedPlatforms: OverrideTarget[] = []

  private _screentimeUsage: ScreentimeUsageResponse | null = null
  private _applicationUsage: AppUsageResponse | null = null
  private _api: FamilySafetyAPI

  constructor(member: RosterMember, api: FamilySafetyAPI) {
    this.userId = member.id
    this.role = member.role
    this.profilePicture = member.profilePicUrl
    this.firstName = member.user.firstName
    this.surname = member.user.lastName
    this._api = api
  }

  async update(): Promise<void> {
    await this._fetchScreentimeUsage()
    await Promise.all([
      this._fetchDevices(),
      this._fetchOverrides(),
      this._fetchApplications(),
      this._fetchBalance(),
    ])
  }

  private async _fetchScreentimeUsage(): Promise<void> {
    const { beginTime, endTime } = todayRange()
    const [deviceRes, appRes] = await Promise.all([
      this._api.getUserDeviceScreentimeUsage(this.userId, beginTime, endTime),
      this._api.getUserAppScreentimeUsage(this.userId, beginTime, endTime),
    ])
    this._screentimeUsage = deviceRes.json as ScreentimeUsageResponse
    this._applicationUsage = appRes.json as AppUsageResponse
    const agg = this._screentimeUsage?.deviceUsageAggregates
    this.todayScreentimeUsage = agg?.totalScreenTime != null
      ? Math.round(agg.totalScreenTime / 60000) : null
    this.averageScreentimeUsage = agg?.dailyAverage != null
      ? Math.round(agg.dailyAverage / 60000) : null
  }

  private async _fetchDevices(): Promise<void> {
    if (!this._screentimeUsage) return
    const res = await this._api.getUserDevices(this.userId)
    this.devices = Device.fromResponse(
      res.json as DevicesResponse,
      this._screentimeUsage,
    )
  }

  private async _fetchOverrides(): Promise<void> {
    const res = await this._api.getOverrideDeviceRestrictions(this.userId)
    this._applyOverrides(res.json as OverridesResponse)
  }

  private async _fetchApplications(): Promise<void> {
    if (!this._applicationUsage) return
    const parsed = Application.fromResponse(this._applicationUsage, this._api, this.userId)
    for (const app of parsed) {
      const existing = this.applications.find((a) => a.appId === app.appId)
      if (existing) {
        existing.update(app)
      } else {
        this.applications.push(app)
      }
    }
  }

  private async _fetchBalance(): Promise<void> {
    const res = await this._api.getUserSpending(this.userId)
    const data = res.json as SpendingResponse
    const balances = data?.balances ?? []
    if (balances.length === 1) {
      this.accountBalance = balances[0].balance
      this.accountCurrency = balances[0].currency
    }
  }

  private _applyOverrides(data: OverridesResponse): void {
    const blocked: OverrideTarget[] = []
    for (const platform of data?.lockablePlatforms ?? []) {
      const isBlocked = platform.overrides.length > 0
      if (isBlocked) {
        const target = Object.values(OverrideTarget).find(
          (v) => v.toLowerCase() === platform.appliesTo.toLowerCase(),
        )
        if (target) blocked.push(target)
      }
      for (const d of platform.devices ?? []) {
        const deviceId = (d.deviceId as string).replace('g:', '')
        const device = this.devices.find((dev) => dev.deviceId === deviceId)
        device?.updateBlockedStatus(isBlocked)
      }
    }
    this.blockedPlatforms = blocked
  }

  async overrideDevice(
    target: OverrideTarget,
    override: OverrideType,
    validUntil?: Date,
  ): Promise<void> {
    if (override === OverrideType.UNTIL && !validUntil) {
      throw new Error('validUntil is required when using OverrideType.UNTIL')
    }
    const until = override === OverrideType.CANCEL ? new Date() : validUntil!
    const res = await this._api.overrideDeviceRestriction(this.userId, {
      overrideType: override,
      target,
      validUntil: until.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    })
    this._applyOverrides(res.json as OverridesResponse)
  }

  getDevice(deviceId: string): Device {
    const d = this.devices.find((x) => x.deviceId === deviceId)
    if (!d) throw new Error(`Device ${deviceId} not found`)
    return d
  }

  getApplication(appId: string): Application {
    const a = this.applications.find((x) => x.appId === appId)
    if (!a) throw new Error(`Application ${appId} not found`)
    return a
  }

  async getScreentimeUsage(
    beginTime?: string,
    endTime?: string,
    deviceCount = 4,
    platform = 'ALL',
  ): Promise<{ devices: ScreentimeUsageResponse; applications: AppUsageResponse }> {
    const range = beginTime && endTime ? { beginTime, endTime } : todayRange()
    const [deviceRes, appRes] = await Promise.all([
      this._api.getUserDeviceScreentimeUsage(
        this.userId,
        range.beginTime,
        range.endTime,
        deviceCount,
        platform,
      ),
      this._api.getUserAppScreentimeUsage(
        this.userId,
        range.beginTime,
        range.endTime,
        platform,
      ),
    ])
    return {
      devices: deviceRes.json as ScreentimeUsageResponse,
      applications: appRes.json as AppUsageResponse,
    }
  }

  static async fromRoster(
    members: RosterMember[],
    api: FamilySafetyAPI,
  ): Promise<Account[]> {
    return Promise.all(
      members
        .filter((m) => m.isDigitalSafetyEnabled)
        .map(async (member) => {
          const account = new Account(member, api)
          await account.update()
          return account
        }),
    )
  }
}
