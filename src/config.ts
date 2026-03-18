import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const CONFIG_DIR = join(homedir(), '.config', 'ms-family-safety')
const CONFIG_FILE = join(CONFIG_DIR, 'credentials.json')

interface Credentials {
  accessToken: string
  refreshToken: string
  expiresAt: string // ISO string
}

export interface SavedCredentials {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

export function saveCredentials(accessToken: string, refreshToken: string, expiresAt: Date): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  }
  const data: Credentials = { accessToken, refreshToken, expiresAt: expiresAt.toISOString() }
  writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), { mode: 0o600 })
}

export function loadCredentials(): SavedCredentials | null {
  if (!existsSync(CONFIG_FILE)) return null
  try {
    const data = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as Credentials
    if (!data.refreshToken) return null
    return {
      accessToken: data.accessToken ?? '',
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : new Date(0),
    }
  } catch {
    return null
  }
}

export function credentialsPath(): string {
  return CONFIG_FILE
}
