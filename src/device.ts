import type { DevicesResponse, ScreentimeUsageResponse } from './types.js'

export class Device {
  deviceId: string
  deviceName: string
  deviceClass: string
  deviceMake: string
  deviceModel: string
  formFactor: string
  osName: string
  lastSeen: string
  issues: unknown
  states: unknown
  todayTimeUsed: number | null = null
  blocked: boolean | null = null

  constructor(data: {
    deviceId: string
    deviceName: string
    deviceClass: string
    deviceMake: string
    deviceModel: string
    deviceFormFactor: string
    osName: string
    lastSeenOn: string
    issues: unknown
    states: unknown
  }) {
    this.deviceId = data.deviceId.replace('g:', '')
    this.deviceName = data.deviceName
    this.deviceClass = data.deviceClass
    this.deviceMake = data.deviceMake
    this.deviceModel = data.deviceModel
    this.formFactor = data.deviceFormFactor
    this.osName = data.osName
    this.lastSeen = data.lastSeenOn
    this.issues = data.issues
    this.states = data.states
  }

  readScreentimeReport(report: ScreentimeUsageResponse): void {
    const aggregates = report.deviceUsageAggregates?.deviceAggregates ?? []
    const match = aggregates.find((d) => d.deviceId === this.deviceId)
    if (match) this.todayTimeUsed = Math.round(match.timeUsed / 60000)
  }

  updateBlockedStatus(blocked: boolean): void {
    this.blocked = blocked
  }

  static fromResponse(
    devicesResponse: DevicesResponse,
    screentimeReport: ScreentimeUsageResponse,
  ): Device[] {
    return (devicesResponse.devices ?? []).map((d) => {
      const device = new Device(d)
      device.readScreentimeReport(screentimeReport)
      return device
    })
  }
}
