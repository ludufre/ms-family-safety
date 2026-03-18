import { AUTH } from './const.js'
import { UnauthorizedError } from './errors.js'
import type { TokenResponse } from './types.js'

export class Authenticator {
  private _accessToken: string | null = null
  private _refreshToken: string | null = null
  private _expires: Date = new Date(0)
  private _userId: string | null = null
  private _refreshPromise: Promise<void> | null = null

  get accessToken(): string {
    return `MSAuth1.0 usertoken="${this._accessToken}", type="MSACT"`
  }

  get refreshToken(): string | null {
    return this._refreshToken
  }

  get userId(): string | null {
    return this._userId
  }

  get accessTokenExpired(): boolean {
    return Date.now() + 60_000 >= this._expires.getTime()
  }

  get rawAccessToken(): string | null {
    return this._accessToken
  }

  get expiresAt(): Date {
    return this._expires
  }

  static fromSaved(rawAccessToken: string, refreshToken: string, expiresAt: Date): Authenticator {
    const auth = new Authenticator()
    auth._accessToken = rawAccessToken
    auth._refreshToken = refreshToken
    auth._expires = expiresAt
    return auth
  }

  static async create(token: string, useRefreshToken = false): Promise<Authenticator> {
    const auth = new Authenticator()
    if (useRefreshToken) {
      auth._refreshToken = token
      await auth.performRefresh()
    } else {
      const code = Authenticator.parseResponseToken(token)
      await auth.performLogin(code)
    }
    return auth
  }

  static parseResponseToken(redirectUrl: string): string {
    const url = new URL(redirectUrl)
    const code = url.searchParams.get('code')
    if (!code) throw new Error('Invalid URL: missing code parameter')
    // URL.searchParams automatically decodes percent-encoded values,
    // preventing the double-encoding bug present in the Python library.
    return code
  }

  static getLoginUrl(loginHint = ''): string {
    const url = new URL(AUTH.AUTHORIZE_BASE_URL)
    url.searchParams.set('client_id', AUTH.CLIENT_ID)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('redirect_uri', AUTH.REDIRECT_URL)
    url.searchParams.set('response_mode', 'query')
    url.searchParams.set('scope', AUTH.SCOPE)
    url.searchParams.set('lw', '1')
    url.searchParams.set('fl', 'easi2')
    url.searchParams.set('login_hint', loginHint)
    return url.toString()
  }

  private async _doTokenRequest(body: URLSearchParams): Promise<TokenResponse> {
    const response = await fetch(AUTH.TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': AUTH.AUTH_USER_AGENT,
        'X-Requested-With': 'com.microsoft.familysafety',
      },
      body: body.toString(),
    })

    if (response.status !== 200) {
      throw new UnauthorizedError()
    }

    return response.json() as Promise<TokenResponse>
  }

  private _applyTokenResponse(tokens: TokenResponse): void {
    this._accessToken = tokens.access_token
    this._refreshToken = tokens.refresh_token
    this._userId = tokens.user_id
    this._expires = new Date(Date.now() + tokens.expires_in * 1000)
  }

  async performLogin(authCode: string): Promise<void> {
    const body = new URLSearchParams({
      client_id: AUTH.CLIENT_ID,
      code: authCode,
      grant_type: 'authorization_code',
      redirect_uri: AUTH.REDIRECT_URL,
      scope: AUTH.SCOPE,
    })
    this._applyTokenResponse(await this._doTokenRequest(body))
  }

  async performRefresh(): Promise<void> {
    if (this._refreshPromise) {
      return this._refreshPromise
    }

    this._refreshPromise = (async () => {
      if (!this._refreshToken) throw new Error('No refresh token available')
      const body = new URLSearchParams({
        client_id: AUTH.CLIENT_ID,
        refresh_token: this._refreshToken,
        grant_type: 'refresh_token',
        scope: AUTH.SCOPE,
      })
      this._applyTokenResponse(await this._doTokenRequest(body))
    })().finally(() => {
      this._refreshPromise = null
    })

    return this._refreshPromise
  }
}
