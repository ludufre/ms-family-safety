<p align="center"><br>
<img src="https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/e0/35/f9/e035f945-599c-9979-e096-4042c780589d/AppIcon-prod-1x_U007emarketing-0-6-0-0-85-220-0.png/128x128bb.jpg" width="128" height="128" />
</p>

### ms-family-safety

Unofficial TypeScript client for the Microsoft Family Safety API — usable as a **library** or **CLI**

> ⚠️ **Disclaimer:** This project is **not affiliated with, endorsed by, or associated with Microsoft Corporation** in any way. Microsoft Family Safety is a trademark of Microsoft Corporation. Use of the Microsoft Family Safety name and logo is solely for identification purposes. This is an independent, community-driven project developed through reverse engineering of the public API.
>
> This project is intended for **personal and research use only**. It must not be used for commercial purposes, sold, or otherwise financially exploited.
>
> Users authenticate using **their own Microsoft account credentials**. No credentials are stored or transmitted by this library beyond what is necessary to call the API on behalf of the authenticated user. The `CLIENT_ID` used is publicly embedded in the official Microsoft Family Safety Android app and is reused solely to enable OAuth authentication on behalf of the user — no impersonation of Microsoft or its services is intended.
>
> **Note to Microsoft employees:** If this repository raises any concerns regarding intellectual property, terms of service, or any other matter, please reach out via [GitHub Issues](https://github.com/ludufre/ms-family-safety/issues) or directly to [@ludufre](https://github.com/ludufre). I will promptly take down or modify the repository upon request — no legal action necessary.

[![Maintenance](https://img.shields.io/maintenance/yes/2025?style=flat-square)](https://github.com/ludufre/ms-family-safety)
[![NPM License](https://img.shields.io/npm/l/ms-family-safety?style=flat-square)](https://www.npmjs.com/package/ms-family-safety)
[![NPM Downloads](https://img.shields.io/npm/dw/ms-family-safety?style=flat-square)](https://www.npmjs.com/package/ms-family-safety)
[![NPM Version](https://img.shields.io/npm/v/ms-family-safety?style=flat-square)](https://www.npmjs.com/package/ms-family-safety)

## Maintainers

| Maintainer | GitHub | Social | LinkedIn |
| ---------------------- | ------------------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| Luan Freitas (ludufre) | [ludufre](https://github.com/ludufre) | [@ludufre](https://x.com/ludufre) | [Luan Freitas](https://www.linkedin.com/in/luan-freitas-14341687/) |

## Installation

> Requires Node.js ≥ 18.

```bash
# as a library
npm install ms-family-safety

# as a global CLI
npm install -g ms-family-safety

# or using pnpm
pnpm add ms-family-safety
pnpm add -g ms-family-safety
```

## Documentation

- [CLI Reference](./docs/cli.md) — authentication, all commands and options
- [Library API](./docs/library.md) — `FamilySafety` class, methods, and low-level API
- [Types Reference](./docs/types.md) — types, interfaces, enums, and errors

## Building from source

```bash
pnpm install
pnpm build       # outputs to dist/
```
