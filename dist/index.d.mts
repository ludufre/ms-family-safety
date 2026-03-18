declare class Authenticator {
    private _accessToken;
    private _refreshToken;
    private _expires;
    private _userId;
    private _refreshPromise;
    get accessToken(): string;
    get refreshToken(): string | null;
    get userId(): string | null;
    get accessTokenExpired(): boolean;
    get rawAccessToken(): string | null;
    get expiresAt(): Date;
    static fromSaved(rawAccessToken: string, refreshToken: string, expiresAt: Date): Authenticator;
    static create(token: string, useRefreshToken?: boolean): Promise<Authenticator>;
    static parseResponseToken(redirectUrl: string): string;
    static getLoginUrl(loginHint?: string): string;
    private _doTokenRequest;
    private _applyTokenResponse;
    performLogin(authCode: string): Promise<void>;
    performRefresh(): Promise<void>;
}

interface ApiResponse<T = unknown> {
    status: number;
    json: T;
    headers: Headers;
}
declare class FamilySafetyAPI {
    private readonly auth;
    constructor(auth: Authenticator);
    sendRequest<T = unknown>(endpoint: string, options?: {
        body?: unknown;
        headers?: Record<string, string>;
        params?: Record<string, string | number>;
    }): Promise<ApiResponse<T>>;
    getAccounts(): Promise<ApiResponse<unknown>>;
    getPendingRequests(): Promise<ApiResponse<unknown>>;
    getUserDevices(userId: string): Promise<ApiResponse<unknown>>;
    getUserSpending(userId: string): Promise<ApiResponse<unknown>>;
    getUserDeviceScreentimeUsage(userId: string, beginTime: string, endTime: string, deviceCount?: number, platform?: string): Promise<ApiResponse<unknown>>;
    getUserAppScreentimeUsage(userId: string, beginTime: string, endTime: string, platform?: string): Promise<ApiResponse<unknown>>;
    getOverrideDeviceRestrictions(userId: string): Promise<ApiResponse<unknown>>;
    overrideDeviceRestriction(userId: string, body: unknown): Promise<ApiResponse<unknown>>;
    setAppPolicy(userId: string, appId: string, body: unknown, platform?: string): Promise<ApiResponse<unknown>>;
    approvePendingRequest(userId: string, body: unknown): Promise<ApiResponse<unknown>>;
    denyPendingRequest(userId: string, body: unknown): Promise<ApiResponse<unknown>>;
    getSchedule(userId: string, platform?: string): Promise<ApiResponse<unknown>>;
    updateSchedule(userId: string, body: unknown, platform?: string): Promise<ApiResponse<unknown>>;
}

declare enum OverrideTarget {
    DESKTOP = "Desktop",
    XBOX = "Xbox",
    MOBILE = "Mobile"
}
declare enum OverrideType {
    CANCEL = "Cancel",
    UNTIL = "BlockUntil"
}
interface TokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user_id: string;
}
interface RosterResponse {
    members: RosterMember[];
}
interface RosterMember {
    id: string;
    role: string;
    profilePicUrl: string;
    isDigitalSafetyEnabled: boolean;
    user: {
        firstName: string;
        lastName: string;
        accountPrimaryAlias: string;
    };
}
interface DevicesResponse {
    devices: DeviceData[];
}
interface DeviceData {
    deviceId: string;
    deviceName: string;
    deviceClass: string;
    deviceMake: string;
    deviceModel: string;
    deviceFormFactor: string;
    osName: string;
    issues: unknown;
    states: unknown;
    lastSeenOn: string;
}
interface ScreentimeUsageResponse {
    deviceUsageAggregates: {
        totalScreenTime: number;
        dailyAverage: number;
        deviceAggregates: Array<{
            deviceId: string;
            timeUsed: number;
        }>;
    };
}
interface AppUsageResponse {
    appActivity: AppActivityEntry[];
}
interface AppActivityEntry {
    appId: string;
    displayName: string;
    iconUrl: string;
    usage: number;
    policy: string;
    blockState: string;
    isLegacyBlocked: boolean;
}
interface OverridesResponse {
    lockablePlatforms: LockablePlatform[];
}
interface LockablePlatform {
    appliesTo: string;
    overrides: unknown[];
    devices: Array<{
        deviceId: string;
    }>;
}
interface SpendingResponse {
    balances: Array<{
        balance: number;
        currency: string;
    }>;
}
interface PendingRequest {
    id: string;
    puid: string;
    type: string;
    lockTime: string;
    platform: string;
    requestedTime: string;
    appName?: string | null;
    isGlobal?: boolean | null;
}
interface PendingRequestsResponse {
    pendingRequests: PendingRequest[];
}
/** `"Windows"` | `"Xbox"` | `"Mobile"` | `"AllDevices"` */
type SchedulePlatform = 'Windows' | 'Xbox' | 'Mobile' | 'AllDevices';
/** `"PerDeviceType"` (per platform) | `"Global"` (one schedule for all) */
type ScheduleMode = 'PerDeviceType' | 'Global';
/** A single allowed time window, e.g. `{ begin: "07:00", end: "22:00" }` */
interface TimeInterval {
    begin: string;
    end: string;
}
/**
 * Daily policy for a single day.
 * - `allowance`: total allowed screen time in **minutes** (0 = no limit set)
 * - `allottedIntervals`: time windows when the device is allowed (empty = no restriction)
 */
interface DayPolicy {
    allowance: number;
    allottedIntervals: TimeInterval[];
}
/**
 * Weekly restrictions object.
 * Each day can be `null` (inherits from `everyday`) or a specific `DayPolicy`.
 * Set `everyday` to apply the same policy to all days.
 */
interface WeeklySchedule {
    monday?: DayPolicy | null;
    tuesday?: DayPolicy | null;
    wednesday?: DayPolicy | null;
    thursday?: DayPolicy | null;
    friday?: DayPolicy | null;
    saturday?: DayPolicy | null;
    sunday?: DayPolicy | null;
    everyday?: DayPolicy | null;
}
/** One platform's schedule entry as returned by the API. */
interface ScheduleEntry {
    enabled: boolean;
    appliesTo: string;
    platformName: string;
    dailyRestrictions: WeeklySchedule;
    usage: number;
}
/** Full response from `GET /v4/devicelimits/schedules/{userId}` */
interface ScheduleResponse {
    mode: ScheduleMode;
    schedules: ScheduleEntry[];
    effectiveActivityReportingState: string;
}
/** Request body for `PUT /v4/devicelimits/schedules/{userId}` */
interface UpdateScheduleRequest {
    dailyRestrictions: WeeklySchedule;
    mode: ScheduleMode;
    appliesTo?: SchedulePlatform;
    culture?: string;
    time?: string;
}

declare class Device {
    deviceId: string;
    deviceName: string;
    deviceClass: string;
    deviceMake: string;
    deviceModel: string;
    formFactor: string;
    osName: string;
    lastSeen: string;
    issues: unknown;
    states: unknown;
    todayTimeUsed: number | null;
    blocked: boolean | null;
    constructor(data: {
        deviceId: string;
        deviceName: string;
        deviceClass: string;
        deviceMake: string;
        deviceModel: string;
        deviceFormFactor: string;
        osName: string;
        lastSeenOn: string;
        issues: unknown;
        states: unknown;
    });
    readScreentimeReport(report: ScreentimeUsageResponse): void;
    updateBlockedStatus(blocked: boolean): void;
    static fromResponse(devicesResponse: DevicesResponse, screentimeReport: ScreentimeUsageResponse): Device[];
}

declare class Application {
    appId: string;
    name: string;
    icon: string;
    policy: string;
    blocked: boolean;
    private _usageMs;
    private _api;
    private _userId;
    constructor(data: {
        appId: string;
        displayName: string;
        iconUrl: string;
        usage: number;
        policy: string;
        blockState: string;
        isLegacyBlocked: boolean;
    }, api: FamilySafetyAPI, userId: string);
    /** Usage in minutes */
    get usage(): number;
    update(app: Application): void;
    blockApp(): Promise<void>;
    unblockApp(): Promise<void>;
    static fromResponse(response: AppUsageResponse, api: FamilySafetyAPI, userId: string): Application[];
}

declare class Account {
    userId: string;
    role: string;
    profilePicture: string;
    firstName: string;
    surname: string;
    devices: Device[];
    applications: Application[];
    todayScreentimeUsage: number | null;
    averageScreentimeUsage: number | null;
    accountBalance: number;
    accountCurrency: string;
    blockedPlatforms: OverrideTarget[];
    private _screentimeUsage;
    private _applicationUsage;
    private _api;
    constructor(member: RosterMember, api: FamilySafetyAPI);
    update(): Promise<void>;
    private _fetchScreentimeUsage;
    private _fetchDevices;
    private _fetchOverrides;
    private _fetchApplications;
    private _fetchBalance;
    private _applyOverrides;
    overrideDevice(target: OverrideTarget, override: OverrideType, validUntil?: Date): Promise<void>;
    getDevice(deviceId: string): Device;
    getApplication(appId: string): Application;
    getScreentimeUsage(beginTime?: string, endTime?: string, deviceCount?: number, platform?: string): Promise<{
        devices: ScreentimeUsageResponse;
        applications: AppUsageResponse;
    }>;
    static fromRoster(members: RosterMember[], api: FamilySafetyAPI): Promise<Account[]>;
}

interface Credentials {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
}
declare class FamilySafety {
    private _api;
    private _auth;
    /** Populated after calling `update()` — not needed for direct method calls. */
    accounts: Account[];
    pendingRequests: PendingRequest[];
    constructor(auth: Authenticator);
    /** Current token state — persist this after operations to avoid unnecessary refreshes. */
    get credentials(): Credentials;
    /**
     * Create from a redirect URL (first login) or a raw refresh token string.
     *
     * @param token - Redirect URL after OAuth login, or a refresh token string
     * @param useRefreshToken - Pass `true` when `token` is a refresh token
     */
    static create(token: string, useRefreshToken?: boolean): Promise<FamilySafety>;
    /**
     * Create from previously saved credentials.
     * Uses the access token directly if still valid; refreshes only when expired.
     */
    static fromSaved(credentials: Credentials): FamilySafety;
    /** Fetch the family roster. Returns members with `isDigitalSafetyEnabled`. */
    getAccounts(): Promise<RosterMember[]>;
    /** Fetch devices for a user, with today's screen time filled in. */
    getDevices(userId: string): Promise<Device[]>;
    /** Fetch apps used today by a user. */
    getApps(userId: string): Promise<Application[]>;
    /** Block an application for a user. */
    blockApp(userId: string, appId: string): Promise<void>;
    /** Unblock an application for a user. */
    unblockApp(userId: string, appId: string): Promise<void>;
    /** Block a device platform until the given date-time. */
    blockDevice(userId: string, target: OverrideTarget, until: Date): Promise<void>;
    /** Cancel an active device block for a platform. */
    unblockDevice(userId: string, target: OverrideTarget): Promise<void>;
    /**
     * Get the current screen time schedule for a user.
     *
     * @param userId - The user's ID
     * @param platform - Filter by platform: `"Windows"`, `"Xbox"`, `"Mobile"`, `"AllDevices"` (default: all)
     * @returns Full schedule response with mode and one entry per platform
     */
    getSchedule(userId: string, platform?: SchedulePlatform): Promise<ScheduleResponse>;
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
    updateSchedule(userId: string, schedule: WeeklySchedule, platform?: SchedulePlatform, mode?: ScheduleMode): Promise<ScheduleResponse>;
    /** Fetch pending screen-time extension requests. */
    getPendingRequests(): Promise<PendingRequest[]>;
    /**
     * Approve a pending screen-time request and grant an extension.
     *
     * @param requestId - The request ID (from `getPendingRequests()`)
     * @param extensionMinutes - Extension to grant in **minutes** (e.g. 60 = 1 hour)
     */
    approvePendingRequest(requestId: string, extensionMinutes: number): Promise<boolean>;
    /** Deny a pending screen-time request. */
    denyPendingRequest(requestId: string): Promise<boolean>;
    /**
     * Fetch and populate `this.accounts` with full device, app, and screentime data.
     * Useful for polling scenarios (e.g. Home Assistant). Not needed for direct method calls.
     */
    update(): Promise<void>;
}

declare class HttpError extends Error {
    readonly statusCode: number;
    readonly body: string;
    constructor(message: string, statusCode: number, body: string);
}
declare class UnauthorizedError extends HttpError {
    constructor();
}
declare class RequestDeniedError extends HttpError {
    constructor(message?: string);
}
declare class AggregatorError extends HttpError {
    constructor();
}

export { Account, AggregatorError, type ApiResponse, type AppActivityEntry, type AppUsageResponse, Application, Authenticator, type Credentials, type DayPolicy, Device, type DeviceData, type DevicesResponse, FamilySafety, FamilySafetyAPI, HttpError, type LockablePlatform, OverrideTarget, OverrideType, type OverridesResponse, type PendingRequest, type PendingRequestsResponse, RequestDeniedError, type RosterMember, type RosterResponse, type ScheduleEntry, type ScheduleMode, type SchedulePlatform, type ScheduleResponse, type ScreentimeUsageResponse, type SpendingResponse, type TimeInterval, type TokenResponse, UnauthorizedError, type UpdateScheduleRequest, type WeeklySchedule };
