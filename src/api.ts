import { ENDPOINTS, USER_AGENT, AGGREGATOR_ERROR } from './const.js'
import type { Authenticator } from './authenticator.js'
import { HttpError, UnauthorizedError, RequestDeniedError, AggregatorError } from './errors.js'

export interface ApiResponse<T = unknown> {
  status: number
  json: T
  headers: Headers
}

export class FamilySafetyAPI {
  constructor(private readonly auth: Authenticator) {}

  async sendRequest<T = unknown>(
    endpoint: string,
    options: {
      body?: unknown
      headers?: Record<string, string>
      params?: Record<string, string | number>
    } = {},
  ): Promise<ApiResponse<T>> {
    const e = ENDPOINTS[endpoint]
    if (!e) throw new Error(`Endpoint "${endpoint}" does not exist`)

    if (this.auth.accessTokenExpired) {
      await this.auth.performRefresh()
    }

    let url = e.url
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        url = url.replace(`{${key}}`, String(value))
      }
    }

    const headers: Record<string, string> = {
      Authorization: this.auth.accessToken,
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
      ...options.headers,
    }

    const response = await fetch(url, {
      method: e.method,
      headers,
      body: options.body != null ? JSON.stringify(options.body) : undefined,
    })

    if (response.status >= 200 && response.status < 300) {
      let json: T = undefined as T
      if (response.status !== 204) {
        try {
          json = (await response.json()) as T
        } catch {
          // non-JSON response
        }
      }
      return { status: response.status, json, headers: response.headers }
    }

    const text = await response.text()
    if (response.status === 500 && text.includes(AGGREGATOR_ERROR)) throw new AggregatorError()
    if (response.status === 401) throw new UnauthorizedError()
    if (response.status === 403) throw new RequestDeniedError(text)
    throw new HttpError('HTTP Error', response.status, text)
  }

  async getAccounts() {
    return this.sendRequest('get_accounts')
  }

  async getPendingRequests() {
    return this.sendRequest('get_pending_requests')
  }

  async getUserDevices(userId: string) {
    return this.sendRequest('get_user_devices', { params: { USER_ID: userId } })
  }

  async getUserSpending(userId: string) {
    return this.sendRequest('get_user_spending', { params: { USER_ID: userId } })
  }

  async getUserDeviceScreentimeUsage(
    userId: string,
    beginTime: string,
    endTime: string,
    deviceCount = 4,
    platform = 'ALL',
  ) {
    return this.sendRequest('get_user_device_screentime_usage', {
      headers: { 'Plat-Info': platform },
      params: {
        USER_ID: userId,
        BEGIN_TIME: encodeURIComponent(beginTime),
        END_TIME: encodeURIComponent(endTime),
        DEVICE_COUNT: deviceCount,
      },
    })
  }

  async getUserAppScreentimeUsage(
    userId: string,
    beginTime: string,
    endTime: string,
    platform = 'ALL',
  ) {
    return this.sendRequest('get_user_app_screentime_usage', {
      headers: { 'Plat-Info': platform },
      params: {
        USER_ID: userId,
        BEGIN_TIME: encodeURIComponent(beginTime),
        END_TIME: encodeURIComponent(endTime),
      },
    })
  }

  async getOverrideDeviceRestrictions(userId: string) {
    return this.sendRequest('get_override_device_restrictions', { params: { USER_ID: userId } })
  }

  async overrideDeviceRestriction(userId: string, body: unknown) {
    return this.sendRequest('override_device_restriction', { body, params: { USER_ID: userId } })
  }

  async setAppPolicy(userId: string, appId: string, body: unknown, platform?: string) {
    return this.sendRequest('set_app_policy', {
      body,
      headers: platform ? { 'Plat-Info': platform } : undefined,
      params: { USER_ID: userId, APP_ID: appId },
    })
  }

  async approvePendingRequest(userId: number, body: unknown) {
    return this.sendRequest('approve_pending_request', { body, params: { USER_ID: userId } })
  }

  async denyPendingRequest(userId: number, body: unknown) {
    return this.sendRequest('deny_pending_request', { body, params: { USER_ID: userId } })
  }

  async getSchedule(userId: string, platform?: string) {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const offsetMin = -now.getTimezoneOffset()
    const sign = offsetMin >= 0 ? '+' : '-'
    const absMin = Math.abs(offsetMin)
    const tz = `${sign}${pad(Math.floor(absMin / 60))}:${pad(absMin % 60)}`
    const time = now.toISOString().replace(/\.\d{3}Z$/, tz)
    const culture = Intl.DateTimeFormat().resolvedOptions().locale.replace('_', '-')
    const platInfo = platform ?? 'Windows'
    return this.sendRequest('get_schedule', {
      headers: { 'Plat-Info': platInfo },
      params: {
        USER_ID: userId,
        PLATFORM: platform ? encodeURIComponent(platform) : '',
        CULTURE: encodeURIComponent(culture),
        TIME: encodeURIComponent(time),
      },
    })
  }

  async updateSchedule(userId: string, body: unknown, platform?: string) {
    const platInfo = platform ?? 'Windows'
    return this.sendRequest('update_schedule', {
      body,
      headers: { 'Plat-Info': platInfo },
      params: { USER_ID: userId },
    })
  }
}
