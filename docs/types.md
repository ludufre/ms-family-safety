# Types Reference

## `Credentials`

```ts
import type { Credentials } from 'ms-family-safety'

interface Credentials {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}
```

Obtain via `fs.credentials`. Persist to your storage and pass to `FamilySafety.fromSaved()` on subsequent runs.

---

## `Device`

Returned by `fs.getDevices(userId)`.

| Property | Type | Description |
|----------|------|-------------|
| `deviceId` | `string` | Device ID (prefix `g:` stripped) |
| `deviceName` | `string` | Display name |
| `deviceClass` | `string` | e.g. `Windows`, `Xbox`, `Android` |
| `deviceMake` | `string` | Manufacturer |
| `deviceModel` | `string` | Model name |
| `formFactor` | `string` | e.g. `PC`, `Phone`, `Console` |
| `osName` | `string` | Operating system |
| `lastSeen` | `string` | ISO date-time of last activity |
| `todayTimeUsed` | `number \| null` | Screen time today (minutes) |
| `blocked` | `boolean \| null` | Whether the device is currently blocked |

---

## `Application`

Returned by `fs.getApps(userId)`.

| Property | Type | Description |
|----------|------|-------------|
| `appId` | `string` | App ID (prefixed: `x:` Xbox, `appx:` Windows, `a:` Mobile) |
| `name` | `string` | Display name |
| `icon` | `string` | Icon URL |
| `usage` | `number` | Usage today in **minutes** |
| `policy` | `string` | Active policy name |
| `blocked` | `boolean` | Whether the app is currently blocked |

---

## `OverrideTarget` / `OverrideType`

```ts
import { OverrideTarget, OverrideType } from 'ms-family-safety'

OverrideTarget.DESKTOP  // 'Desktop'
OverrideTarget.XBOX     // 'Xbox'
OverrideTarget.MOBILE   // 'Mobile'

OverrideType.UNTIL      // block until a date
OverrideType.CANCEL     // cancel active block
```

---

## Schedule types

```ts
import type {
  SchedulePlatform,
  ScheduleMode,
  TimeInterval,
  DayPolicy,
  WeeklySchedule,
  ScheduleEntry,
  ScheduleResponse,
} from 'ms-family-safety'
```

### `SchedulePlatform`

`"Windows"` | `"Xbox"` | `"Mobile"` | `"AllDevices"`

### `ScheduleMode`

`"PerDeviceType"` — separate schedule per platform
`"Global"` — one schedule for all platforms

### `DayPolicy`

| Property | Type | Description |
|----------|------|-------------|
| `allowance` | `number` | Total allowed screen time in **minutes** (0 = no limit) |
| `allottedIntervals` | `TimeInterval[]` | Time windows when the device is allowed |

### `TimeInterval`

| Property | Type | Example |
|----------|------|---------|
| `begin` | `string` | `"07:00"` |
| `end` | `string` | `"22:00"` |

### `WeeklySchedule`

Each day (`monday` … `sunday`, `everyday`) is either a `DayPolicy` or `null`.
Setting `everyday` applies the same policy to all days.

### `ScheduleEntry`

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether limits are active |
| `appliesTo` | `string` | Platform key (e.g. `"Windows"`) |
| `platformName` | `string` | Display name |
| `dailyRestrictions` | `WeeklySchedule` | Per-day policies |
| `usage` | `number` | Screen time used today in **minutes** |

### `ScheduleResponse`

| Property | Type | Description |
|----------|------|-------------|
| `mode` | `ScheduleMode` | Global or per-device scheduling mode |
| `schedules` | `ScheduleEntry[]` | One entry per platform |
| `effectiveActivityReportingState` | `string` | Activity reporting state |

---

## Errors

| Class | Status | Description |
|-------|--------|-------------|
| `HttpError` | any | Base HTTP error with `.statusCode` and `.body` |
| `UnauthorizedError` | 401 | Token expired or invalid |
| `RequestDeniedError` | 403 | Insufficient permissions |
| `AggregatorError` | 500 | Upstream Microsoft aggregator failure |

```ts
import { UnauthorizedError } from 'ms-family-safety'

try {
  const accounts = await fs.getAccounts()
} catch (err) {
  if (err instanceof UnauthorizedError) {
    // re-authenticate
  }
}
```
