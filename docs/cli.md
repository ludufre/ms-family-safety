# CLI Reference

After running `ms-family-safety login` once, **all commands work with no flags**:

```bash
ms-family-safety accounts
ms-family-safety apps <user-id>

# or using the short alias
mfs accounts
mfs apps <user-id>
```

The `-t` flag exists only to override the saved credentials (e.g. in scripts or CI):

| Flag | Description |
|------|-------------|
| `-t, --token <token>` | Use this refresh token instead of the saved credentials |

---

## Authentication

Microsoft Family Safety uses an OAuth2 authorization-code flow with a legacy `MBI_SSL` scope.

### 1. Get the login URL

```bash
ms-family-safety login-url --hint you@example.com
```

Open the printed URL in a browser, sign in, and copy the final redirect URL (it starts with `https://login.live.com/oauth20_desktop.srf?code=...`).

### 2. Exchange the code for tokens

```bash
ms-family-safety login "https://login.live.com/oauth20_desktop.srf?code=..."
```

Output:

```
Logged in. Credentials saved to /Users/you/.config/ms-family-safety/credentials.json
```

The access token, refresh token, and expiry are saved to `~/.config/ms-family-safety/credentials.json` (permissions `600`). All subsequent CLI commands use them automatically — no flags needed.

To remove the saved credentials:

```bash
ms-family-safety logout
```

---

## Commands

### `login-url`

Print the Microsoft OAuth login URL.

```bash
ms-family-safety login-url [--hint <email>]
```

### `login`

Exchange the redirect URL for tokens and save them.

```bash
ms-family-safety login "<redirect-url>"
```

Saves access token + refresh token + expiry to `~/.config/ms-family-safety/credentials.json`.

### `logout`

Remove the saved credentials file.

```bash
ms-family-safety logout
```

### `accounts`

List all family member accounts.

```bash
ms-family-safety accounts
```

### `devices`

List devices for a user with today's screen time.

```bash
ms-family-safety devices <user-id>
```

### `apps`

List apps used today by a user, with usage time and block status.

```bash
ms-family-safety apps <user-id>
```

### `block-app`

Block an application for a user.

```bash
ms-family-safety block-app <user-id> <app-id>
```

### `unblock-app`

Unblock an application for a user.

```bash
ms-family-safety unblock-app <user-id> <app-id>
```

### `block-device`

Block a device platform until a given date-time.

```bash
ms-family-safety block-device <user-id> <target> <until>
```

- `<target>`: `Desktop`, `Xbox`, or `Mobile`
- `<until>`: ISO 8601 date-time, e.g. `2024-06-01T22:00:00`

### `unblock-device`

Cancel an active device block.

```bash
ms-family-safety unblock-device <user-id> <target>
```

### `pending`

List pending screen-time extension requests.

```bash
ms-family-safety pending
```

### `approve-request`

Approve a pending screen-time request and grant an extension.

```bash
ms-family-safety approve-request <request-id> <minutes>
```

- `<request-id>`: ID from the `pending` command
- `<minutes>`: Extension in minutes (e.g. `60` = 1 hour)

Common values: `15`, `30`, `60`, `120`, `180`

### `deny-request`

Deny a pending screen-time request.

```bash
ms-family-safety deny-request <request-id>
```

### `get-schedule`

Show the screen time schedule for a user.

```bash
ms-family-safety get-schedule <user-id> [-p <platform>]
```

- `-p, --platform`: `Windows`, `Xbox`, `Mobile`, or `AllDevices` (default: all platforms)

### `set-schedule`

Set daily screen time limits for a user. All time values are in **minutes**.

```bash
ms-family-safety set-schedule <user-id> <platform> <allowance> [options]
```

- `<platform>`: `Windows`, `Xbox`, `Mobile`, or `AllDevices`
- `<allowance>`: Daily screen time limit in **minutes** (e.g. `120` = 2 hours)
- `--begin <HH:mm>`: Allowed from (default: `07:00`)
- `--end <HH:mm>`: Allowed until (default: `22:00`)
- `--weekend-allowance <minutes>`: Override allowance for Saturday/Sunday
- `--everyday`: Apply the same policy to all days

```bash
# Limit Windows to 2h on weekdays, 4h on weekends, allowed 7am–10pm
ms-family-safety set-schedule <user-id> Windows 120 --weekend-allowance 240

# Same limit every day
ms-family-safety set-schedule <user-id> Mobile 90 --everyday

# Custom time window
ms-family-safety set-schedule <user-id> Xbox 60 --begin 16:00 --end 21:00
```
