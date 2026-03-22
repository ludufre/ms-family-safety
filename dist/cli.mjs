#!/usr/bin/env node

// src/cli.ts
import { unlinkSync, existsSync as existsSync2 } from "fs";
import { Command } from "commander";

// src/const.ts
var BASE_URL = "https://mobileaggregator.family.microsoft.com/api";
var APP_VERSION = "v 2.0.5.1103";
var USER_AGENT = `Family Safety-prod/(${APP_VERSION}) Android/33 google/Pixel 4 XL`;
var AGGREGATOR_ERROR = "Something went wrong in the Aggregator service";
var AUTH = {
  CLIENT_ID: "000000000004893A",
  SCOPE: "service::familymobile.microsoft.com::MBI_SSL",
  TOKEN_ENDPOINT: "https://login.live.com/oauth20_token.srf",
  REDIRECT_URL: "https://login.live.com/oauth20_desktop.srf",
  AUTHORIZE_BASE_URL: "https://login.live.com/oauth20_authorize.srf?cobrandid=b5d15d4b-695a-4cd5-93c6-13f551b310df",
  AUTH_USER_AGENT: "Mozilla/5.0 (Linux; Android 13; Pixel 4 XL Build/TQ3A.230705.001.B4; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/115.0.5790.166 Mobile Safari/537.36"
};
var ENDPOINTS = {
  get_accounts: {
    url: `${BASE_URL}/v2/roster`,
    method: "GET"
  },
  get_pending_requests: {
    url: `${BASE_URL}/v1/PendingRequests`,
    method: "GET"
  },
  deny_pending_request: {
    url: `${BASE_URL}/v1/pendingRequests/deny/{USER_ID}`,
    method: "POST"
  },
  approve_pending_request: {
    url: `${BASE_URL}/v1/pendingRequests/approve/{USER_ID}`,
    method: "POST"
  },
  get_premium_entitlement: {
    url: `${BASE_URL}/v1/entitlement`,
    method: "GET"
  },
  get_user_device_screentime_usage: {
    url: `${BASE_URL}/v4/activityreport/deviceScreenTimeUsage/{USER_ID}?beginTime={BEGIN_TIME}&endTime={END_TIME}&topDeviceCount={DEVICE_COUNT}`,
    method: "GET"
  },
  get_user_app_screentime_usage: {
    url: `${BASE_URL}/v4/activityReport/appUsage/{USER_ID}?beginTime={BEGIN_TIME}&endTime={END_TIME}`,
    method: "GET"
  },
  get_user_devices: {
    url: `${BASE_URL}/v1/devices/{USER_ID}`,
    method: "GET"
  },
  get_user_spending: {
    url: `${BASE_URL}/v1/Spending/{USER_ID}`,
    method: "GET"
  },
  get_user_payment_methods: {
    url: `${BASE_URL}/v1/spending/paymentmethods/{USER_ID}?cid={CID}`,
    method: "GET"
  },
  get_user_content_restrictions: {
    url: `${BASE_URL}/v1/ContentRestrictions/{USER_ID}`,
    method: "GET"
  },
  get_user_web_restrictions: {
    url: `${BASE_URL}/v1/WebRestrictions/{USER_ID}`,
    method: "GET"
  },
  get_user_web_activity: {
    url: `${BASE_URL}/v1/activityreport/webactivity/{USER_ID}?beginTime={BEGIN_TIME}&endTime={END_TIME}&allowStatus={ALLOW_STATUS}`,
    method: "GET"
  },
  get_user_search_activity: {
    url: `${BASE_URL}/v1/activityreport/searchactivity/{USER_ID}?beginTime={BEGIN_TIME}&endTime={END_TIME}`,
    method: "GET"
  },
  get_override_device_restrictions: {
    url: `${BASE_URL}/v1/devicelimits/{USER_ID}/overrides`,
    method: "GET"
  },
  override_device_restriction: {
    url: `${BASE_URL}/v1/devicelimits/{USER_ID}/overrides`,
    method: "POST"
  },
  set_app_policy: {
    url: `${BASE_URL}/v3/appLimits/policies/{USER_ID}/{APP_ID}`,
    method: "PATCH"
  },
  get_schedule: {
    url: `${BASE_URL}/v4/devicelimits/schedules/{USER_ID}?platform={PLATFORM}&culture={CULTURE}&time={TIME}`,
    method: "GET"
  },
  update_schedule: {
    url: `${BASE_URL}/v4/devicelimits/schedules/{USER_ID}`,
    method: "PATCH"
  },
  update_web_restrictions: {
    url: `${BASE_URL}/v1/WebRestrictions/{USER_ID}`,
    method: "PATCH"
  },
  update_content_restrictions: {
    url: `${BASE_URL}/v1/ContentRestrictions/{USER_ID}`,
    method: "PATCH"
  },
  get_additional_permission_token: {
    url: `${BASE_URL}/v1/FamilyPermission/permissiontoken/{USER_ID}?scopes={SCOPES}`,
    method: "GET"
  }
};

// src/errors.ts
var HttpError = class extends Error {
  constructor(message, statusCode, body) {
    super(message);
    this.statusCode = statusCode;
    this.body = body;
    this.name = "HttpError";
  }
};
var UnauthorizedError = class extends HttpError {
  constructor() {
    super("HTTP Unauthorized", 401, "");
    this.name = "UnauthorizedError";
  }
};
var RequestDeniedError = class extends HttpError {
  constructor(message = "HTTP Access Denied") {
    super(message, 403, message);
    this.name = "RequestDeniedError";
  }
};
var AggregatorError = class extends HttpError {
  constructor() {
    super("An upstream aggregator error occurred.", 500, "");
    this.name = "AggregatorError";
  }
};

// src/authenticator.ts
var Authenticator = class _Authenticator {
  _accessToken = null;
  _refreshToken = null;
  _expires = /* @__PURE__ */ new Date(0);
  _userId = null;
  _refreshPromise = null;
  get accessToken() {
    return `MSAuth1.0 usertoken="${this._accessToken}", type="MSACT"`;
  }
  get refreshToken() {
    return this._refreshToken;
  }
  get userId() {
    return this._userId;
  }
  get accessTokenExpired() {
    return Date.now() + 6e4 >= this._expires.getTime();
  }
  get rawAccessToken() {
    return this._accessToken;
  }
  get expiresAt() {
    return this._expires;
  }
  static fromSaved(rawAccessToken, refreshToken, expiresAt) {
    const auth = new _Authenticator();
    auth._accessToken = rawAccessToken;
    auth._refreshToken = refreshToken;
    auth._expires = expiresAt;
    return auth;
  }
  static async create(token, useRefreshToken = false) {
    const auth = new _Authenticator();
    if (useRefreshToken) {
      auth._refreshToken = token;
      await auth.performRefresh();
    } else {
      const code = _Authenticator.parseResponseToken(token);
      await auth.performLogin(code);
    }
    return auth;
  }
  static parseResponseToken(redirectUrl) {
    const url = new URL(redirectUrl);
    const code = url.searchParams.get("code");
    if (!code) throw new Error("Invalid URL: missing code parameter");
    return code;
  }
  static getLoginUrl(loginHint = "") {
    const url = new URL(AUTH.AUTHORIZE_BASE_URL);
    url.searchParams.set("client_id", AUTH.CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", AUTH.REDIRECT_URL);
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", AUTH.SCOPE);
    url.searchParams.set("lw", "1");
    url.searchParams.set("fl", "easi2");
    url.searchParams.set("login_hint", loginHint);
    return url.toString();
  }
  async _doTokenRequest(body) {
    const response = await fetch(AUTH.TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": AUTH.AUTH_USER_AGENT,
        "X-Requested-With": "com.microsoft.familysafety"
      },
      body: body.toString()
    });
    if (response.status !== 200) {
      throw new UnauthorizedError();
    }
    return response.json();
  }
  _applyTokenResponse(tokens) {
    this._accessToken = tokens.access_token;
    this._refreshToken = tokens.refresh_token;
    this._userId = tokens.user_id;
    this._expires = new Date(Date.now() + tokens.expires_in * 1e3);
  }
  async performLogin(authCode) {
    const body = new URLSearchParams({
      client_id: AUTH.CLIENT_ID,
      code: authCode,
      grant_type: "authorization_code",
      redirect_uri: AUTH.REDIRECT_URL,
      scope: AUTH.SCOPE
    });
    this._applyTokenResponse(await this._doTokenRequest(body));
  }
  async performRefresh() {
    if (this._refreshPromise) {
      return this._refreshPromise;
    }
    this._refreshPromise = (async () => {
      if (!this._refreshToken) throw new Error("No refresh token available");
      const body = new URLSearchParams({
        client_id: AUTH.CLIENT_ID,
        refresh_token: this._refreshToken,
        grant_type: "refresh_token",
        scope: AUTH.SCOPE
      });
      this._applyTokenResponse(await this._doTokenRequest(body));
    })().finally(() => {
      this._refreshPromise = null;
    });
    return this._refreshPromise;
  }
};

// src/api.ts
var FamilySafetyAPI = class {
  constructor(auth) {
    this.auth = auth;
  }
  async sendRequest(endpoint, options = {}) {
    const e = ENDPOINTS[endpoint];
    if (!e) throw new Error(`Endpoint "${endpoint}" does not exist`);
    if (this.auth.accessTokenExpired) {
      await this.auth.performRefresh();
    }
    let url = e.url;
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        url = url.replace(`{${key}}`, String(value));
      }
    }
    const headers = {
      Authorization: this.auth.accessToken,
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
      ...options.headers
    };
    const response = await fetch(url, {
      method: e.method,
      headers,
      body: options.body != null ? JSON.stringify(options.body) : void 0
    });
    if (response.status >= 200 && response.status < 300) {
      let json = void 0;
      if (response.status !== 204) {
        try {
          json = await response.json();
        } catch {
        }
      }
      return { status: response.status, json, headers: response.headers };
    }
    const text = await response.text();
    if (response.status === 500 && text.includes(AGGREGATOR_ERROR)) throw new AggregatorError();
    if (response.status === 401) throw new UnauthorizedError();
    if (response.status === 403) throw new RequestDeniedError(text);
    throw new HttpError("HTTP Error", response.status, text);
  }
  async getAccounts() {
    return this.sendRequest("get_accounts");
  }
  async getPendingRequests() {
    return this.sendRequest("get_pending_requests");
  }
  async getUserDevices(userId) {
    return this.sendRequest("get_user_devices", { params: { USER_ID: userId } });
  }
  async getUserSpending(userId) {
    return this.sendRequest("get_user_spending", { params: { USER_ID: userId } });
  }
  async getUserDeviceScreentimeUsage(userId, beginTime, endTime, deviceCount = 4, platform = "ALL") {
    return this.sendRequest("get_user_device_screentime_usage", {
      headers: { "Plat-Info": platform },
      params: {
        USER_ID: userId,
        BEGIN_TIME: encodeURIComponent(beginTime),
        END_TIME: encodeURIComponent(endTime),
        DEVICE_COUNT: deviceCount
      }
    });
  }
  async getUserAppScreentimeUsage(userId, beginTime, endTime, platform = "ALL") {
    return this.sendRequest("get_user_app_screentime_usage", {
      headers: { "Plat-Info": platform },
      params: {
        USER_ID: userId,
        BEGIN_TIME: encodeURIComponent(beginTime),
        END_TIME: encodeURIComponent(endTime)
      }
    });
  }
  async getOverrideDeviceRestrictions(userId) {
    return this.sendRequest("get_override_device_restrictions", { params: { USER_ID: userId } });
  }
  async overrideDeviceRestriction(userId, body) {
    return this.sendRequest("override_device_restriction", { body, params: { USER_ID: userId } });
  }
  async setAppPolicy(userId, appId, body, platform) {
    return this.sendRequest("set_app_policy", {
      body,
      headers: platform ? { "Plat-Info": platform } : void 0,
      params: { USER_ID: userId, APP_ID: appId }
    });
  }
  async approvePendingRequest(userId, body) {
    return this.sendRequest("approve_pending_request", { body, params: { USER_ID: userId } });
  }
  async denyPendingRequest(userId, body) {
    return this.sendRequest("deny_pending_request", { body, params: { USER_ID: userId } });
  }
  async getSchedule(userId, platform) {
    const now = /* @__PURE__ */ new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const offsetMin = -now.getTimezoneOffset();
    const sign = offsetMin >= 0 ? "+" : "-";
    const absMin = Math.abs(offsetMin);
    const tz = `${sign}${pad(Math.floor(absMin / 60))}:${pad(absMin % 60)}`;
    const time = now.toISOString().replace(/\.\d{3}Z$/, tz);
    const culture = Intl.DateTimeFormat().resolvedOptions().locale.replace("_", "-");
    const platInfo = platform ?? "Windows";
    return this.sendRequest("get_schedule", {
      headers: { "Plat-Info": platInfo },
      params: {
        USER_ID: userId,
        PLATFORM: platform ? encodeURIComponent(platform) : "",
        CULTURE: encodeURIComponent(culture),
        TIME: encodeURIComponent(time)
      }
    });
  }
  async updateSchedule(userId, body, platform) {
    const platInfo = platform ?? "Windows";
    return this.sendRequest("update_schedule", {
      body,
      headers: { "Plat-Info": platInfo },
      params: { USER_ID: userId }
    });
  }
};

// src/device.ts
var Device = class _Device {
  deviceId;
  deviceName;
  deviceClass;
  deviceMake;
  deviceModel;
  formFactor;
  osName;
  lastSeen;
  issues;
  states;
  todayTimeUsed = null;
  blocked = null;
  constructor(data) {
    this.deviceId = data.deviceId.replace("g:", "");
    this.deviceName = data.deviceName;
    this.deviceClass = data.deviceClass;
    this.deviceMake = data.deviceMake;
    this.deviceModel = data.deviceModel;
    this.formFactor = data.deviceFormFactor;
    this.osName = data.osName;
    this.lastSeen = data.lastSeenOn;
    this.issues = data.issues;
    this.states = data.states;
  }
  readScreentimeReport(report) {
    const aggregates = report.deviceUsageAggregates?.deviceAggregates ?? [];
    const match = aggregates.find((d) => d.deviceId === this.deviceId);
    if (match) this.todayTimeUsed = Math.round(match.timeUsed / 6e4);
  }
  updateBlockedStatus(blocked) {
    this.blocked = blocked;
  }
  static fromResponse(devicesResponse, screentimeReport) {
    return (devicesResponse.devices ?? []).map((d) => {
      const device = new _Device(d);
      device.readScreentimeReport(screentimeReport);
      return device;
    });
  }
};

// src/application.ts
function getPlatform(appId) {
  if (appId.startsWith("x:")) return "XBOX";
  if (appId.startsWith("appx:")) return "WINDOWS";
  if (appId.startsWith("a:")) return "MOBILE";
  return void 0;
}
var Application = class _Application {
  appId;
  name;
  icon;
  policy;
  blocked;
  _usageMs;
  _api;
  _userId;
  constructor(data, api, userId) {
    this.appId = data.appId;
    this.name = data.displayName;
    this.icon = data.iconUrl;
    this._usageMs = data.usage;
    this.policy = data.policy;
    this.blocked = data.blockState === "Blocked" || data.blockState === "BlockedAlways" || data.isLegacyBlocked;
    this._api = api;
    this._userId = userId;
  }
  /** Usage in minutes */
  get usage() {
    return this._usageMs / 1e3 / 60;
  }
  update(app) {
    this.appId = app.appId;
    this.name = app.name;
    this.icon = app.icon;
    this._usageMs = app.usage * 60 * 1e3;
    this.policy = app.policy;
    this.blocked = app.blocked;
  }
  async blockApp() {
    await this._api.setAppPolicy(
      this._userId,
      this.appId,
      {
        appId: this.appId,
        appTimeEnforcementPolicy: "WeekendAndWeekday",
        blockState: "BlockedAlways",
        blocked: false,
        displayName: this.appId,
        enabled: true
      },
      getPlatform(this.appId)
    );
    this.blocked = true;
  }
  async unblockApp() {
    await this._api.setAppPolicy(
      this._userId,
      this.appId,
      {
        appId: this.appId,
        appTimeEnforcementPolicy: "WeekendAndWeekday",
        blockState: "NotBlocked",
        blocked: false,
        displayName: this.appId,
        enabled: true
      },
      getPlatform(this.appId)
    );
    this.blocked = false;
  }
  static fromResponse(response, api, userId) {
    return (response.appActivity ?? []).map((entry) => new _Application(entry, api, userId));
  }
};

// src/types.ts
var OverrideTarget = /* @__PURE__ */ ((OverrideTarget3) => {
  OverrideTarget3["DESKTOP"] = "Desktop";
  OverrideTarget3["XBOX"] = "Xbox";
  OverrideTarget3["MOBILE"] = "Mobile";
  return OverrideTarget3;
})(OverrideTarget || {});

// src/account.ts
function formatLocalISO(date) {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMin);
  const hh = String(Math.floor(absMin / 60)).padStart(2, "0");
  const mm = String(absMin % 60).padStart(2, "0");
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hh}:${mm}`;
}
function todayRange() {
  const now = /* @__PURE__ */ new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return {
    beginTime: formatLocalISO(start),
    endTime: formatLocalISO(end)
  };
}
var Account = class _Account {
  userId;
  role;
  profilePicture;
  firstName;
  surname;
  devices = [];
  applications = [];
  todayScreentimeUsage = null;
  averageScreentimeUsage = null;
  accountBalance = 0;
  accountCurrency = "";
  blockedPlatforms = [];
  _screentimeUsage = null;
  _applicationUsage = null;
  _api;
  constructor(member, api) {
    this.userId = member.id;
    this.role = member.role;
    this.profilePicture = member.profilePicUrl;
    this.firstName = member.user.firstName;
    this.surname = member.user.lastName;
    this._api = api;
  }
  async update() {
    await this._fetchScreentimeUsage();
    await Promise.all([
      this._fetchDevices(),
      this._fetchOverrides(),
      this._fetchApplications(),
      this._fetchBalance()
    ]);
  }
  async _fetchScreentimeUsage() {
    const { beginTime, endTime } = todayRange();
    const [deviceRes, appRes] = await Promise.all([
      this._api.getUserDeviceScreentimeUsage(this.userId, beginTime, endTime),
      this._api.getUserAppScreentimeUsage(this.userId, beginTime, endTime)
    ]);
    this._screentimeUsage = deviceRes.json;
    this._applicationUsage = appRes.json;
    const agg = this._screentimeUsage?.deviceUsageAggregates;
    this.todayScreentimeUsage = agg?.totalScreenTime != null ? Math.round(agg.totalScreenTime / 6e4) : null;
    this.averageScreentimeUsage = agg?.dailyAverage != null ? Math.round(agg.dailyAverage / 6e4) : null;
  }
  async _fetchDevices() {
    if (!this._screentimeUsage) return;
    const res = await this._api.getUserDevices(this.userId);
    this.devices = Device.fromResponse(
      res.json,
      this._screentimeUsage
    );
  }
  async _fetchOverrides() {
    const res = await this._api.getOverrideDeviceRestrictions(this.userId);
    this._applyOverrides(res.json);
  }
  async _fetchApplications() {
    if (!this._applicationUsage) return;
    const parsed = Application.fromResponse(this._applicationUsage, this._api, this.userId);
    for (const app of parsed) {
      const existing = this.applications.find((a) => a.appId === app.appId);
      if (existing) {
        existing.update(app);
      } else {
        this.applications.push(app);
      }
    }
  }
  async _fetchBalance() {
    const res = await this._api.getUserSpending(this.userId);
    const data = res.json;
    const balances = data?.balances ?? [];
    if (balances.length === 1) {
      this.accountBalance = balances[0].balance;
      this.accountCurrency = balances[0].currency;
    }
  }
  _applyOverrides(data) {
    const blocked = [];
    for (const platform of data?.lockablePlatforms ?? []) {
      const isBlocked = platform.overrides.length > 0;
      if (isBlocked) {
        const target = Object.values(OverrideTarget).find(
          (v) => v.toLowerCase() === platform.appliesTo.toLowerCase()
        );
        if (target) blocked.push(target);
      }
      for (const d of platform.devices ?? []) {
        const deviceId = d.deviceId.replace("g:", "");
        const device = this.devices.find((dev) => dev.deviceId === deviceId);
        device?.updateBlockedStatus(isBlocked);
      }
    }
    this.blockedPlatforms = blocked;
  }
  async overrideDevice(target, override, validUntil) {
    if (override === "BlockUntil" /* UNTIL */ && !validUntil) {
      throw new Error("validUntil is required when using OverrideType.UNTIL");
    }
    const until = override === "Cancel" /* CANCEL */ ? /* @__PURE__ */ new Date() : validUntil;
    const res = await this._api.overrideDeviceRestriction(this.userId, {
      overrideType: override,
      target,
      validUntil: until.toISOString().replace(/\.\d{3}Z$/, "Z")
    });
    this._applyOverrides(res.json);
  }
  getDevice(deviceId) {
    const d = this.devices.find((x) => x.deviceId === deviceId);
    if (!d) throw new Error(`Device ${deviceId} not found`);
    return d;
  }
  getApplication(appId) {
    const a = this.applications.find((x) => x.appId === appId);
    if (!a) throw new Error(`Application ${appId} not found`);
    return a;
  }
  async getScreentimeUsage(beginTime, endTime, deviceCount = 4, platform = "ALL") {
    const range = beginTime && endTime ? { beginTime, endTime } : todayRange();
    const [deviceRes, appRes] = await Promise.all([
      this._api.getUserDeviceScreentimeUsage(
        this.userId,
        range.beginTime,
        range.endTime,
        deviceCount,
        platform
      ),
      this._api.getUserAppScreentimeUsage(
        this.userId,
        range.beginTime,
        range.endTime,
        platform
      )
    ]);
    return {
      devices: deviceRes.json,
      applications: appRes.json
    };
  }
  static async fromRoster(members, api) {
    return Promise.all(
      members.filter((m) => m.isDigitalSafetyEnabled).map(async (member) => {
        const account = new _Account(member, api);
        await account.update();
        return account;
      })
    );
  }
};

// src/family-safety.ts
function todayRange2() {
  const now = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const offsetMin = -now.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMin);
  const tz = `${sign}${pad(Math.floor(absMin / 60))}:${pad(absMin % 60)}`;
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return {
    beginTime: `${date}T00:00:00${tz}`,
    endTime: `${date}T23:59:59${tz}`
  };
}
var FamilySafety = class _FamilySafety {
  _api;
  _auth;
  /** Populated after calling `update()` — not needed for direct method calls. */
  accounts = [];
  pendingRequests = [];
  constructor(auth) {
    this._auth = auth;
    this._api = new FamilySafetyAPI(auth);
  }
  /** Current token state — persist this after operations to avoid unnecessary refreshes. */
  get credentials() {
    return {
      accessToken: this._auth.rawAccessToken ?? "",
      refreshToken: this._auth.refreshToken ?? "",
      expiresAt: this._auth.expiresAt
    };
  }
  /**
   * Create from a redirect URL (first login) or a raw refresh token string.
   *
   * @param token - Redirect URL after OAuth login, or a refresh token string
   * @param useRefreshToken - Pass `true` when `token` is a refresh token
   */
  static async create(token, useRefreshToken = false) {
    const auth = await Authenticator.create(token, useRefreshToken);
    return new _FamilySafety(auth);
  }
  /**
   * Create from previously saved credentials.
   * Uses the access token directly if still valid; refreshes only when expired.
   */
  static fromSaved(credentials) {
    const auth = Authenticator.fromSaved(
      credentials.accessToken,
      credentials.refreshToken,
      credentials.expiresAt
    );
    return new _FamilySafety(auth);
  }
  // ---------------------------------------------------------------------------
  // Accounts
  // ---------------------------------------------------------------------------
  /** Fetch the family roster. Returns members with `isDigitalSafetyEnabled`. */
  async getAccounts() {
    const res = await this._api.getAccounts();
    const data = res.json;
    return (data.members ?? []).filter((m) => m.isDigitalSafetyEnabled);
  }
  // ---------------------------------------------------------------------------
  // Devices
  // ---------------------------------------------------------------------------
  /** Fetch devices for a user, with today's screen time filled in. */
  async getDevices(userId) {
    const { beginTime, endTime } = todayRange2();
    const [devicesRes, screentimeRes] = await Promise.all([
      this._api.getUserDevices(userId),
      this._api.getUserDeviceScreentimeUsage(userId, beginTime, endTime)
    ]);
    return Device.fromResponse(
      devicesRes.json,
      screentimeRes.json
    );
  }
  // ---------------------------------------------------------------------------
  // Applications
  // ---------------------------------------------------------------------------
  /** Fetch apps used today by a user. */
  async getApps(userId) {
    const { beginTime, endTime } = todayRange2();
    const res = await this._api.getUserAppScreentimeUsage(userId, beginTime, endTime);
    return Application.fromResponse(res.json, this._api, userId);
  }
  /** Block an application for a user. */
  async blockApp(userId, appId) {
    await this._api.setAppPolicy(
      userId,
      appId,
      {
        appId,
        appTimeEnforcementPolicy: "WeekendAndWeekday",
        blockState: "BlockedAlways",
        blocked: false,
        displayName: appId,
        enabled: true
      },
      getAppPlatform(appId)
    );
  }
  /** Unblock an application for a user. */
  async unblockApp(userId, appId) {
    await this._api.setAppPolicy(
      userId,
      appId,
      {
        appId,
        appTimeEnforcementPolicy: "WeekendAndWeekday",
        blockState: "NotBlocked",
        blocked: false,
        displayName: appId,
        enabled: true
      },
      getAppPlatform(appId)
    );
  }
  // ---------------------------------------------------------------------------
  // Device overrides (block/unblock by platform)
  // ---------------------------------------------------------------------------
  /** Block a device platform until the given date-time. */
  async blockDevice(userId, target, until) {
    await this._api.overrideDeviceRestriction(userId, {
      overrideType: "BlockUntil" /* UNTIL */,
      target,
      validUntil: until.toISOString().replace(/\.\d{3}Z$/, "Z")
    });
  }
  /** Cancel an active device block for a platform. */
  async unblockDevice(userId, target) {
    await this._api.overrideDeviceRestriction(userId, {
      overrideType: "Cancel" /* CANCEL */,
      target,
      validUntil: (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "Z")
    });
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
  async getSchedule(userId, platform) {
    const res = await this._api.getSchedule(userId, platform);
    return scheduleToMinutes(res.json);
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
  async updateSchedule(userId, schedule, platform, mode = "PerDeviceType") {
    const now = /* @__PURE__ */ new Date();
    const offsetMin = -now.getTimezoneOffset();
    const sign = offsetMin >= 0 ? "+" : "-";
    const pad = (n) => String(Math.abs(n)).padStart(2, "0");
    const tz = `${sign}${pad(Math.floor(Math.abs(offsetMin) / 60))}:${pad(Math.abs(offsetMin) % 60)}`;
    const time = now.toISOString().replace(/\.\d{3}Z$/, tz);
    const culture = Intl.DateTimeFormat().resolvedOptions().locale.replace("_", "-");
    const body = {
      dailyRestrictions: weeklyToMs(schedule),
      mode,
      appliesTo: platform,
      culture,
      time
    };
    const res = await this._api.updateSchedule(userId, body, platform);
    return scheduleToMinutes(res.json);
  }
  // ---------------------------------------------------------------------------
  // Pending requests
  // ---------------------------------------------------------------------------
  /** Fetch pending screen-time extension requests. */
  async getPendingRequests() {
    const res = await this._api.getPendingRequests();
    const data = res.json;
    return (data?.pendingRequests ?? []).filter((r) => r.type === "DeviceScreenTime");
  }
  /**
   * Approve a pending screen-time request and grant an extension.
   *
   * @param puid - The user's PUID (from `getAccounts()`)
   * @param extensionMinutes - Extension to grant in **minutes** (e.g. 60 = 1 hour)
   */
  async approvePendingRequest(puid, extensionMinutes) {
    const requests = await this.getPendingRequests();
    const request = requests.find((r) => r.puid === puid);
    if (!request) throw new Error(`No pending request found for user ${puid}`);
    const res = await this._api.approvePendingRequest(request.puid, {
      type: request.type,
      id: request.id,
      request: {
        appId: request.id,
        lockTime: request.lockTime,
        appName: request.appName ?? null,
        extension: extensionMinutes * 6e4,
        platform: request.platform,
        isGlobal: request.isGlobal ?? null,
        requestedTime: request.requestedTime
      }
    });
    return res.status === 204;
  }
  /** Deny a pending screen-time request. */
  async denyPendingRequest(puid) {
    const requests = await this.getPendingRequests();
    const request = requests.find((r) => r.puid === puid);
    if (!request) throw new Error(`No pending request found for user ${puid}`);
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
        requestedTime: request.requestedTime
      }
    });
    return res.status === 204;
  }
  // ---------------------------------------------------------------------------
  // Polling / Home Assistant style (loads everything eagerly)
  // ---------------------------------------------------------------------------
  /**
   * Fetch and populate `this.accounts` with full device, app, and screentime data.
   * Useful for polling scenarios (e.g. Home Assistant). Not needed for direct method calls.
   */
  async update() {
    try {
      if (this.accounts.length === 0) {
        const res = await this._api.getAccounts();
        const data = res.json;
        this.accounts = await Account.fromRoster(data.members ?? [], this._api);
      } else {
        await Promise.all(this.accounts.map((a) => a.update()));
      }
    } catch (err) {
      if (err instanceof AggregatorError) {
        console.warn("Aggregator error occurred, skipping update.");
        return;
      }
      throw err;
    }
  }
};
function getAppPlatform(appId) {
  if (appId.startsWith("x:")) return "XBOX";
  if (appId.startsWith("appx:")) return "WINDOWS";
  if (appId.startsWith("a:")) return "MOBILE";
  return void 0;
}
function dayToMs(day) {
  if (!day) return day;
  return { ...day, allowance: day.allowance * 6e4 };
}
function weeklyToMs(w) {
  return {
    monday: dayToMs(w.monday),
    tuesday: dayToMs(w.tuesday),
    wednesday: dayToMs(w.wednesday),
    thursday: dayToMs(w.thursday),
    friday: dayToMs(w.friday),
    saturday: dayToMs(w.saturday),
    sunday: dayToMs(w.sunday),
    everyday: dayToMs(w.everyday)
  };
}
function dayToMinutes(day) {
  if (!day) return day;
  return { ...day, allowance: Math.round(day.allowance / 6e4) };
}
function weeklyToMinutes(w) {
  return {
    monday: dayToMinutes(w.monday),
    tuesday: dayToMinutes(w.tuesday),
    wednesday: dayToMinutes(w.wednesday),
    thursday: dayToMinutes(w.thursday),
    friday: dayToMinutes(w.friday),
    saturday: dayToMinutes(w.saturday),
    sunday: dayToMinutes(w.sunday),
    everyday: dayToMinutes(w.everyday)
  };
}
function scheduleToMinutes(response) {
  return {
    ...response,
    schedules: response.schedules?.map((entry) => ({
      ...entry,
      usage: Math.round(entry.usage / 6e4),
      dailyRestrictions: weeklyToMinutes(entry.dailyRestrictions)
    })) ?? []
  };
}

// src/config.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var CONFIG_DIR = join(homedir(), ".config", "ms-family-safety");
var CONFIG_FILE = join(CONFIG_DIR, "credentials.json");
function saveCredentials(accessToken, refreshToken, expiresAt) {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 448 });
  }
  const data = { accessToken, refreshToken, expiresAt: expiresAt.toISOString() };
  writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), { mode: 384 });
}
function loadCredentials() {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    const data = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    if (!data.refreshToken) return null;
    return {
      accessToken: data.accessToken ?? "",
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : /* @__PURE__ */ new Date(0)
    };
  } catch {
    return null;
  }
}
function credentialsPath() {
  return CONFIG_FILE;
}

// src/cli.ts
var program = new Command();
program.name("ms-family-safety").description("Microsoft Family Safety CLI").version("1.0.0");
program.command("login-url").description("Print the Microsoft login URL").option("--hint <email>", "Login hint (email address)").action((opts) => {
  console.log(Authenticator.getLoginUrl(opts.hint ?? ""));
});
program.command("login").description("Exchange the redirect URL for tokens and save credentials").argument("<redirect-url>", "The redirect URL after login (contains the code)").action(async (redirectUrl) => {
  const auth = await Authenticator.create(redirectUrl);
  saveCredentials(auth.rawAccessToken, auth.refreshToken, auth.expiresAt);
  console.log(`Logged in. Credentials saved to ${credentialsPath()}`);
});
program.command("logout").description("Remove the saved credentials").action(() => {
  const path = credentialsPath();
  if (existsSync2(path)) {
    unlinkSync(path);
    console.log("Credentials removed.");
  } else {
    console.log("No saved credentials found.");
  }
});
function buildFamilySafety(opts) {
  if (opts.token) {
    return FamilySafety.fromSaved({ accessToken: "", refreshToken: opts.token, expiresAt: /* @__PURE__ */ new Date(0) });
  }
  const saved = loadCredentials();
  if (!saved) {
    console.error("No saved credentials found. Run `ms-family-safety login <redirect-url>` first.");
    process.exit(1);
  }
  return FamilySafety.fromSaved(saved);
}
function persist(fs) {
  const { accessToken, refreshToken, expiresAt } = fs.credentials;
  if (refreshToken) saveCredentials(accessToken, refreshToken, expiresAt);
}
var commonOpts = (cmd) => cmd.option("-t, --token <token>", "Override saved credentials with this refresh token");
commonOpts(
  program.command("accounts").description("List all family accounts")
).action(async (opts) => {
  const fs = buildFamilySafety(opts);
  const accounts = await fs.getAccounts();
  console.log(JSON.stringify(accounts, null, 2));
  persist(fs);
});
commonOpts(
  program.command("devices").description("List a user's devices with today's screen time").argument("<user-id>", "User ID")
).action(async (userId, opts) => {
  const fs = buildFamilySafety(opts);
  const devices = await fs.getDevices(userId);
  console.log(JSON.stringify(devices, null, 2));
  persist(fs);
});
commonOpts(
  program.command("apps").description("List apps used today by a user").argument("<user-id>", "User ID")
).action(async (userId, opts) => {
  const fs = buildFamilySafety(opts);
  const apps = await fs.getApps(userId);
  console.log(
    JSON.stringify(
      apps.map((a) => ({
        appId: a.appId,
        name: a.name,
        usageMinutes: Math.round(a.usage),
        blocked: a.blocked,
        policy: a.policy
      })),
      null,
      2
    )
  );
  persist(fs);
});
commonOpts(
  program.command("block-app").description("Block an application for a user").argument("<user-id>", "User ID").argument("<app-id>", "Application ID")
).action(async (userId, appId, opts) => {
  const fs = buildFamilySafety(opts);
  await fs.blockApp(userId, appId);
  console.log(`Blocked ${appId}`);
  persist(fs);
});
commonOpts(
  program.command("unblock-app").description("Unblock an application for a user").argument("<user-id>", "User ID").argument("<app-id>", "Application ID")
).action(async (userId, appId, opts) => {
  const fs = buildFamilySafety(opts);
  await fs.unblockApp(userId, appId);
  console.log(`Unblocked ${appId}`);
  persist(fs);
});
commonOpts(
  program.command("block-device").description("Block a device platform for a user").argument("<user-id>", "User ID").argument("<target>", `Platform: ${Object.values(OverrideTarget).join(", ")}`).argument("<until>", "Block until ISO date-time (e.g. 2024-01-01T22:00:00)")
).action(async (userId, target, until, opts) => {
  const overrideTarget = Object.values(OverrideTarget).find(
    (v) => v.toLowerCase() === target.toLowerCase()
  );
  if (!overrideTarget) {
    console.error(`Invalid target. Valid values: ${Object.values(OverrideTarget).join(", ")}`);
    process.exit(1);
  }
  const fs = buildFamilySafety(opts);
  await fs.blockDevice(userId, overrideTarget, new Date(until));
  console.log(`Blocked ${target} until ${until}`);
  persist(fs);
});
commonOpts(
  program.command("unblock-device").description("Cancel device block for a user").argument("<user-id>", "User ID").argument("<target>", `Platform: ${Object.values(OverrideTarget).join(", ")}`)
).action(async (userId, target, opts) => {
  const overrideTarget = Object.values(OverrideTarget).find(
    (v) => v.toLowerCase() === target.toLowerCase()
  );
  if (!overrideTarget) {
    console.error(`Invalid target. Valid values: ${Object.values(OverrideTarget).join(", ")}`);
    process.exit(1);
  }
  const fs = buildFamilySafety(opts);
  await fs.unblockDevice(userId, overrideTarget);
  console.log(`Unblocked ${target}`);
  persist(fs);
});
commonOpts(
  program.command("get-schedule").description("Show the screen time schedule for a user").argument("<user-id>", "User ID").option("-p, --platform <platform>", "Filter by platform: Windows, Xbox, Mobile, AllDevices")
).action(async (userId, opts) => {
  const fs = buildFamilySafety(opts);
  const schedule = await fs.getSchedule(userId, opts.platform);
  console.log(JSON.stringify(schedule, null, 2));
  persist(fs);
});
commonOpts(
  program.command("set-schedule").description("Set daily screen time limit for a user (allowance in minutes)").argument("<user-id>", "User ID").argument("<platform>", "Platform: Windows, Xbox, Mobile, AllDevices").argument("<allowance>", "Daily allowance in minutes (e.g. 120 = 2h)").option("--begin <time>", "Allowed from (HH:mm)", "07:00").option("--end <time>", "Allowed until (HH:mm)", "22:00").option("--weekend-allowance <minutes>", "Override allowance for Saturday/Sunday (minutes)").option("--everyday", "Apply same policy to all days", false)
).action(async (userId, platform, allowanceStr, opts) => {
  const allowance = parseInt(allowanceStr, 10);
  if (isNaN(allowance) || allowance < 0) {
    console.error("Allowance must be a non-negative number of minutes");
    process.exit(1);
  }
  const intervals = [{ begin: opts.begin, end: opts.end }];
  const day = { allowance, allottedIntervals: intervals };
  const weekendAllowance = opts.weekendAllowance ? parseInt(opts.weekendAllowance, 10) : allowance;
  const weekend = { allowance: weekendAllowance, allottedIntervals: intervals };
  const schedule = opts.everyday ? { everyday: day } : {
    monday: day,
    tuesday: day,
    wednesday: day,
    thursday: day,
    friday: day,
    saturday: weekend,
    sunday: weekend
  };
  const fs = buildFamilySafety(opts);
  await fs.updateSchedule(userId, schedule, platform);
  console.log(`Schedule updated for ${platform}: ${allowance}min/day (weekdays), ${weekendAllowance}min/day (weekends), ${opts.begin}\u2013${opts.end}`);
  persist(fs);
});
commonOpts(
  program.command("pending").description("List pending screen-time requests")
).action(async (opts) => {
  const fs = buildFamilySafety(opts);
  const requests = await fs.getPendingRequests();
  console.log(JSON.stringify(requests, null, 2));
  persist(fs);
});
commonOpts(
  program.command("approve-request").description("Approve a pending screen-time request").argument("<user-id>", "User PUID (from the `accounts` command)").argument("<minutes>", "Extension to grant in minutes (e.g. 60 = 1 hour)")
).action(async (userIdStr, minutesStr, opts) => {
  const puid = parseInt(userIdStr, 10);
  const minutes = parseInt(minutesStr, 10);
  if (isNaN(minutes) || minutes <= 0) {
    console.error("Minutes must be a positive number");
    process.exit(1);
  }
  const fs = buildFamilySafety(opts);
  await fs.approvePendingRequest(puid, minutes);
  console.log(`Approved pending request for user ${puid} with ${minutes} minute(s) extension`);
  persist(fs);
});
commonOpts(
  program.command("deny-request").description("Deny a pending screen-time request").argument("<user-id>", "User PUID (from the `accounts` command)")
).action(async (userIdStr, opts) => {
  const puid = parseInt(userIdStr, 10);
  const fs = buildFamilySafety(opts);
  await fs.denyPendingRequest(puid);
  console.log(`Denied pending request for user ${puid}`);
  persist(fs);
});
program.parseAsync(process.argv).catch((err) => {
  if (err instanceof HttpError) {
    console.error(`HTTP ${err.statusCode}: ${err.body}`);
  } else {
    console.error(err instanceof Error ? err.message : err);
  }
  process.exit(1);
});
