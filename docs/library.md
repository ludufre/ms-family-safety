# Library API

## `FamilySafety`

Main entry point. Authenticate once, then call methods directly — no `update()` required.

```ts
import { FamilySafety, OverrideTarget, type Credentials } from 'ms-family-safety'

// First login (redirect URL or refresh token)
const fs = await FamilySafety.create(refreshToken, true)

// From previously saved credentials (skips refresh if token is still valid)
const fs = FamilySafety.fromSaved(savedCredentials)
```

After any operation, persist the credentials in case a token refresh happened internally:

```ts
await db.save('credentials', fs.credentials)
// { accessToken, refreshToken, expiresAt }
```

### Factory methods

| Method | Description |
|--------|-------------|
| `FamilySafety.create(token, useRefreshToken?)` | Login with redirect URL or refresh token |
| `FamilySafety.fromSaved(credentials)` | Restore from saved `Credentials` object |

### `credentials` property

```ts
const { accessToken, refreshToken, expiresAt } = fs.credentials
```

Returns the current token state. Persist this after operations so the next call to `fromSaved()` can skip an unnecessary refresh.

### Account methods

```ts
// Family roster (members with digital safety enabled)
const members = await fs.getAccounts()  // RosterMember[]
```

### Device methods

```ts
// Devices with today's screen time
const devices = await fs.getDevices(userId)  // Device[]
```

### App methods

```ts
// Apps used today
const apps = await fs.getApps(userId)  // Application[]

await fs.blockApp(userId, appId)
await fs.unblockApp(userId, appId)
```

### Device override methods

```ts
import { OverrideTarget } from 'ms-family-safety'

await fs.blockDevice(userId, OverrideTarget.DESKTOP, new Date('2024-06-01T22:00:00'))
await fs.blockDevice(userId, OverrideTarget.XBOX,    new Date('2024-06-01T22:00:00'))
await fs.unblockDevice(userId, OverrideTarget.MOBILE)
```

### Schedule methods

All time values are in **minutes**.

```ts
import type { SchedulePlatform, WeeklySchedule } from 'ms-family-safety'

// Get current screen time schedule
const schedule = await fs.getSchedule(userId)                // ScheduleResponse
const winSchedule = await fs.getSchedule(userId, 'Windows')  // filtered by platform

// Update screen time schedule
await fs.updateSchedule(userId, {
  monday:    { allowance: 120, allottedIntervals: [{ begin: '07:00', end: '22:00' }] },
  tuesday:   { allowance: 120, allottedIntervals: [{ begin: '07:00', end: '22:00' }] },
  wednesday: { allowance: 120, allottedIntervals: [{ begin: '07:00', end: '22:00' }] },
  thursday:  { allowance: 120, allottedIntervals: [{ begin: '07:00', end: '22:00' }] },
  friday:    { allowance: 120, allottedIntervals: [{ begin: '07:00', end: '22:00' }] },
  saturday:  { allowance: 240, allottedIntervals: [{ begin: '07:00', end: '22:00' }] },
  sunday:    { allowance: 240, allottedIntervals: [{ begin: '07:00', end: '22:00' }] },
}, 'Windows')

// Same limit every day
await fs.updateSchedule(userId, {
  everyday: { allowance: 90, allottedIntervals: [{ begin: '08:00', end: '21:00' }] },
}, 'Mobile')
```

### Pending request methods

```ts
const requests = await fs.getPendingRequests()    // PendingRequest[]
await fs.approvePendingRequest(requestId, 60)     // grant 1h extension (in minutes)
await fs.denyPendingRequest(requestId)
```

### Polling mode (Home Assistant / background refresh)

`update()` eagerly fetches all accounts with their devices, apps, and screen time data. Useful for polling scenarios — not needed for regular use.

```ts
await fs.update()
// fs.accounts is now populated with full Account objects
for (const account of fs.accounts) {
  console.log(account.firstName, account.todayScreentimeUsage)  // minutes
  console.log(account.averageScreentimeUsage)                   // minutes
  console.log(account.devices)
  console.log(account.applications)
}
```

---

## Low-level API (`FamilySafetyAPI`)

For direct HTTP access without the higher-level abstractions:

```ts
import { Authenticator, FamilySafetyAPI } from 'ms-family-safety'

const auth = await Authenticator.create(refreshToken, true)
const api  = new FamilySafetyAPI(auth)

const { json, status, headers } = await api.getAccounts()
```

| Method | Description |
|--------|-------------|
| `getAccounts()` | Family roster (`GET /v2/roster`) |
| `getPendingRequests()` | Pending requests (`GET /v1/PendingRequests`) |
| `getUserDevices(userId)` | User's devices (`GET /v1/devices/{userId}`) |
| `getUserSpending(userId)` | Account balance (`GET /v1/Spending/{userId}`) |
| `getUserDeviceScreentimeUsage(userId, begin, end, count?, platform?)` | Device screen time (`GET /v4/activityreport/deviceScreenTimeUsage/...`) |
| `getUserAppScreentimeUsage(userId, begin, end, platform?)` | App usage (`GET /v4/activityReport/appUsage/...`) |
| `getOverrideDeviceRestrictions(userId)` | Active overrides (`GET /v1/devicelimits/{userId}/overrides`) |
| `overrideDeviceRestriction(userId, body)` | Create override (`POST /v1/devicelimits/{userId}/overrides`) |
| `setAppPolicy(userId, appId, body, platform?)` | Set app block policy (`PATCH /v3/appLimits/policies/{userId}/{appId}`) |
| `approvePendingRequest(userId, body)` | Approve request (`POST /v1/pendingRequests/approve/{userId}`) |
| `denyPendingRequest(userId, body)` | Deny request (`POST /v1/pendingRequests/deny/{userId}`) |
| `getSchedule(userId, platform?)` | Get schedule (`GET /v4/devicelimits/schedules/{userId}`) |
| `updateSchedule(userId, body, platform?)` | Update schedule (`PATCH /v4/devicelimits/schedules/{userId}`) |

All methods return `Promise<ApiResponse<T>>` where:

```ts
interface ApiResponse<T> {
  status: number   // HTTP status code
  json: T          // parsed response body
  headers: Headers // response headers
}
```
