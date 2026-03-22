#!/usr/bin/env node
import { unlinkSync, existsSync } from 'node:fs'
import { Command } from 'commander'
import { Authenticator } from './authenticator.js'
import { FamilySafety } from './family-safety.js'
import { OverrideTarget, OverrideType } from './types.js'
import { HttpError } from './errors.js'
import type { SchedulePlatform, WeeklySchedule, DayPolicy } from './types.js'
import { saveCredentials, loadCredentials, credentialsPath } from './config.js'

const program = new Command()

program
  .name('ms-family-safety')
  .description('Microsoft Family Safety CLI')
  .version('1.0.0')

program
  .command('login-url')
  .description('Print the Microsoft login URL')
  .option('--hint <email>', 'Login hint (email address)')
  .action((opts) => {
    console.log(Authenticator.getLoginUrl(opts.hint ?? ''))
  })

program
  .command('login')
  .description('Exchange the redirect URL for tokens and save credentials')
  .argument('<redirect-url>', 'The redirect URL after login (contains the code)')
  .action(async (redirectUrl: string) => {
    const auth = await Authenticator.create(redirectUrl)
    saveCredentials(auth.rawAccessToken!, auth.refreshToken!, auth.expiresAt)
    console.log(`Logged in. Credentials saved to ${credentialsPath()}`)
  })

program
  .command('logout')
  .description('Remove the saved credentials')
  .action(() => {
    const path = credentialsPath()
    if (existsSync(path)) {
      unlinkSync(path)
      console.log('Credentials removed.')
    } else {
      console.log('No saved credentials found.')
    }
  })

function buildFamilySafety(opts: { token?: string }): FamilySafety {
  if (opts.token) {
    return FamilySafety.fromSaved({ accessToken: '', refreshToken: opts.token, expiresAt: new Date(0) })
  }
  const saved = loadCredentials()
  if (!saved) {
    console.error('No saved credentials found. Run `ms-family-safety login <redirect-url>` first.')
    process.exit(1)
  }
  return FamilySafety.fromSaved(saved)
}

function persist(fs: FamilySafety): void {
  const { accessToken, refreshToken, expiresAt } = fs.credentials
  if (refreshToken) saveCredentials(accessToken, refreshToken, expiresAt)
}

const commonOpts = (cmd: Command) =>
  cmd.option('-t, --token <token>', 'Override saved credentials with this refresh token')

commonOpts(
  program
    .command('accounts')
    .description('List all family accounts'),
).action(async (opts) => {
  const fs = buildFamilySafety(opts)
  const accounts = await fs.getAccounts()
  console.log(JSON.stringify(accounts, null, 2))
  persist(fs)
})

commonOpts(
  program
    .command('devices')
    .description("List a user's devices with today's screen time")
    .argument('<user-id>', 'User ID'),
).action(async (userId: string, opts) => {
  const fs = buildFamilySafety(opts)
  const devices = await fs.getDevices(userId)
  console.log(JSON.stringify(devices, null, 2))
  persist(fs)
})

commonOpts(
  program
    .command('apps')
    .description("List apps used today by a user")
    .argument('<user-id>', 'User ID'),
).action(async (userId: string, opts) => {
  const fs = buildFamilySafety(opts)
  const apps = await fs.getApps(userId)
  console.log(
    JSON.stringify(
      apps.map((a) => ({
        appId: a.appId,
        name: a.name,
        usageMinutes: Math.round(a.usage),
        blocked: a.blocked,
        policy: a.policy,
      })),
      null,
      2,
    ),
  )
  persist(fs)
})

commonOpts(
  program
    .command('block-app')
    .description('Block an application for a user')
    .argument('<user-id>', 'User ID')
    .argument('<app-id>', 'Application ID'),
).action(async (userId: string, appId: string, opts) => {
  const fs = buildFamilySafety(opts)
  await fs.blockApp(userId, appId)
  console.log(`Blocked ${appId}`)
  persist(fs)
})

commonOpts(
  program
    .command('unblock-app')
    .description('Unblock an application for a user')
    .argument('<user-id>', 'User ID')
    .argument('<app-id>', 'Application ID'),
).action(async (userId: string, appId: string, opts) => {
  const fs = buildFamilySafety(opts)
  await fs.unblockApp(userId, appId)
  console.log(`Unblocked ${appId}`)
  persist(fs)
})

commonOpts(
  program
    .command('block-device')
    .description('Block a device platform for a user')
    .argument('<user-id>', 'User ID')
    .argument('<target>', `Platform: ${Object.values(OverrideTarget).join(', ')}`)
    .argument('<until>', 'Block until ISO date-time (e.g. 2024-01-01T22:00:00)'),
).action(async (userId: string, target: string, until: string, opts) => {
  const overrideTarget = Object.values(OverrideTarget).find(
    (v) => v.toLowerCase() === target.toLowerCase(),
  )
  if (!overrideTarget) {
    console.error(`Invalid target. Valid values: ${Object.values(OverrideTarget).join(', ')}`)
    process.exit(1)
  }
  const fs = buildFamilySafety(opts)
  await fs.blockDevice(userId, overrideTarget, new Date(until))
  console.log(`Blocked ${target} until ${until}`)
  persist(fs)
})

commonOpts(
  program
    .command('unblock-device')
    .description('Cancel device block for a user')
    .argument('<user-id>', 'User ID')
    .argument('<target>', `Platform: ${Object.values(OverrideTarget).join(', ')}`),
).action(async (userId: string, target: string, opts) => {
  const overrideTarget = Object.values(OverrideTarget).find(
    (v) => v.toLowerCase() === target.toLowerCase(),
  )
  if (!overrideTarget) {
    console.error(`Invalid target. Valid values: ${Object.values(OverrideTarget).join(', ')}`)
    process.exit(1)
  }
  const fs = buildFamilySafety(opts)
  await fs.unblockDevice(userId, overrideTarget)
  console.log(`Unblocked ${target}`)
  persist(fs)
})

commonOpts(
  program
    .command('get-schedule')
    .description('Show the screen time schedule for a user')
    .argument('<user-id>', 'User ID')
    .option('-p, --platform <platform>', 'Filter by platform: Windows, Xbox, Mobile, AllDevices'),
).action(async (userId: string, opts) => {
  const fs = buildFamilySafety(opts)
  const schedule = await fs.getSchedule(userId, opts.platform as SchedulePlatform | undefined)
  console.log(JSON.stringify(schedule, null, 2))
  persist(fs)
})

commonOpts(
  program
    .command('set-schedule')
    .description('Set daily screen time limit for a user (allowance in minutes)')
    .argument('<user-id>', 'User ID')
    .argument('<platform>', 'Platform: Windows, Xbox, Mobile, AllDevices')
    .argument('<allowance>', 'Daily allowance in minutes (e.g. 120 = 2h)')
    .option('--begin <time>', 'Allowed from (HH:mm)', '07:00')
    .option('--end <time>', 'Allowed until (HH:mm)', '22:00')
    .option('--weekend-allowance <minutes>', 'Override allowance for Saturday/Sunday (minutes)')
    .option('--everyday', 'Apply same policy to all days', false),
).action(async (userId: string, platform: string, allowanceStr: string, opts) => {
  const allowance = parseInt(allowanceStr, 10)
  if (isNaN(allowance) || allowance < 0) {
    console.error('Allowance must be a non-negative number of minutes')
    process.exit(1)
  }

  const intervals = [{ begin: opts.begin as string, end: opts.end as string }]
  const day: DayPolicy = { allowance, allottedIntervals: intervals }
  const weekendAllowance = opts.weekendAllowance
    ? parseInt(opts.weekendAllowance as string, 10)
    : allowance
  const weekend: DayPolicy = { allowance: weekendAllowance, allottedIntervals: intervals }

  const schedule: WeeklySchedule = opts.everyday
    ? { everyday: day }
    : {
        monday: day,
        tuesday: day,
        wednesday: day,
        thursday: day,
        friday: day,
        saturday: weekend,
        sunday: weekend,
      }

  const fs = buildFamilySafety(opts)
  await fs.updateSchedule(userId, schedule, platform as SchedulePlatform)
  console.log(`Schedule updated for ${platform}: ${allowance}min/day (weekdays), ${weekendAllowance}min/day (weekends), ${opts.begin}–${opts.end}`)
  persist(fs)
})

commonOpts(
  program
    .command('pending')
    .description('List pending screen-time requests'),
).action(async (opts) => {
  const fs = buildFamilySafety(opts)
  const requests = await fs.getPendingRequests()
  console.log(JSON.stringify(requests, null, 2))
  persist(fs)
})

commonOpts(
  program
    .command('approve-request')
    .description('Approve a pending screen-time request')
    .argument('<user-id>', 'User PUID (from the `accounts` command)')
    .argument('<minutes>', 'Extension to grant in minutes (e.g. 60 = 1 hour)'),
).action(async (userIdStr: string, minutesStr: string, opts) => {
  const puid = parseInt(userIdStr, 10)
  const minutes = parseInt(minutesStr, 10)
  if (isNaN(minutes) || minutes <= 0) {
    console.error('Minutes must be a positive number')
    process.exit(1)
  }
  const fs = buildFamilySafety(opts)
  await fs.approvePendingRequest(puid, minutes)
  console.log(`Approved pending request for user ${puid} with ${minutes} minute(s) extension`)
  persist(fs)
})

commonOpts(
  program
    .command('deny-request')
    .description('Deny a pending screen-time request')
    .argument('<user-id>', 'User PUID (from the `accounts` command)'),
).action(async (userIdStr: string, opts) => {
  const puid = parseInt(userIdStr, 10)
  const fs = buildFamilySafety(opts)
  await fs.denyPendingRequest(puid)
  console.log(`Denied pending request for user ${puid}`)
  persist(fs)
})

program.parseAsync(process.argv).catch((err) => {
  if (err instanceof HttpError) {
    console.error(`HTTP ${err.statusCode}: ${err.body}`)
  } else {
    console.error(err instanceof Error ? err.message : err)
  }
  process.exit(1)
})
