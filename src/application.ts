import type { FamilySafetyAPI } from './api.js'
import type { AppUsageResponse } from './types.js'

function getPlatform(appId: string): string | undefined {
  if (appId.startsWith('x:')) return 'XBOX'
  if (appId.startsWith('appx:')) return 'WINDOWS'
  if (appId.startsWith('a:')) return 'MOBILE'
  return undefined
}

export class Application {
  appId: string
  name: string
  icon: string
  policy: string
  blocked: boolean
  private _usageMs: number
  private _api: FamilySafetyAPI
  private _userId: string

  constructor(
    data: {
      appId: string
      displayName: string
      iconUrl: string
      usage: number
      policy: string
      blockState: string
      isLegacyBlocked: boolean
    },
    api: FamilySafetyAPI,
    userId: string,
  ) {
    this.appId = data.appId
    this.name = data.displayName
    this.icon = data.iconUrl
    this._usageMs = data.usage
    this.policy = data.policy
    this.blocked =
      data.blockState === 'Blocked' ||
      data.blockState === 'BlockedAlways' ||
      data.isLegacyBlocked
    this._api = api
    this._userId = userId
  }

  /** Usage in minutes */
  get usage(): number {
    return this._usageMs / 1000 / 60
  }

  update(app: Application): void {
    this.appId = app.appId
    this.name = app.name
    this.icon = app.icon
    this._usageMs = app.usage * 60 * 1000
    this.policy = app.policy
    this.blocked = app.blocked
  }

  async blockApp(): Promise<void> {
    await this._api.setAppPolicy(
      this._userId,
      this.appId,
      {
        appId: this.appId,
        appTimeEnforcementPolicy: 'WeekendAndWeekday',
        blockState: 'BlockedAlways',
        blocked: false,
        displayName: this.appId,
        enabled: true,
      },
      getPlatform(this.appId),
    )
    this.blocked = true
  }

  async unblockApp(): Promise<void> {
    await this._api.setAppPolicy(
      this._userId,
      this.appId,
      {
        appId: this.appId,
        appTimeEnforcementPolicy: 'WeekendAndWeekday',
        blockState: 'NotBlocked',
        blocked: false,
        displayName: this.appId,
        enabled: true,
      },
      getPlatform(this.appId),
    )
    this.blocked = false
  }

  static fromResponse(
    response: AppUsageResponse,
    api: FamilySafetyAPI,
    userId: string,
  ): Application[] {
    return (response.appActivity ?? []).map((entry) => new Application(entry, api, userId))
  }
}
