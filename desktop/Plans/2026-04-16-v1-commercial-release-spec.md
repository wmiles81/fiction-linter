# Fiction Linter Desktop v1.0 — Commercial Release Spec

**Date:** 2026-04-16
**Status:** Draft — pending user review
**Product:** Fiction Linter Desktop
**Publisher:** Ocotillo Quill Press LLC
**Price:** $19–29 one-time purchase
**Platforms:** macOS (arm64 + x64), Windows, Linux

---

## 1. Executive Summary

Ship the current Fiction Linter Desktop feature set as a paid one-time-purchase product. The app is feature-complete for v1.0 — no new features are added in this release cycle. This spec covers four deliverables:

1. **License gateway** — LemonSqueezy-backed key validation on first launch
2. **Cross-platform packaging** — macOS (signed + notarized), Windows (NSIS installer), Linux (AppImage + .deb)
3. **Auto-update** — background update checks via electron-updater + GitHub Releases
4. **Polish pass** — about dialog, error boundaries, branding, first-run experience, version bump to 1.0.0

---

## 2. Licensing Gateway

### 2.1 Provider

**LemonSqueezy** (lemonsqueezy.com)

- Free plan: $0/month, handles up to $50K revenue
- Per-transaction fee: 5% + $0.50 (at $24 avg price = ~$1.70/sale = ~7%)
- Provides: hosted checkout page, license key generation, REST API for validation
- Multi-product: one store supports Fiction Linter, Focus Viewer, Arcwright as separate products
- No vendor lock-in: keys are standard strings, validation is one HTTPS call

### 2.2 License Key Flow

```
App launches
  │
  ├── Read stored key from userData/license.json
  │     │
  │     ├── Key exists + cached validation < 30 days old
  │     │     └── App opens (no network call)
  │     │
  │     ├── Key exists + cached validation > 30 days old
  │     │     ├── Network available → re-validate against LemonSqueezy API
  │     │     │     ├── Valid → update cache timestamp, open app
  │     │     │     └── Invalid → show "License expired or revoked" → license dialog
  │     │     └── Network unavailable → grace period (open app, re-check next launch)
  │     │
  │     └── Key exists but malformed / decryption failed
  │           └── Clear key → license dialog
  │
  └── No key found
        └── License dialog (modal, blocks app)
              │
              ├── Text field: "Enter your license key"
              ├── [Activate] button → validate against LemonSqueezy API
              │     ├── Valid → encrypt + store key, open app
              │     └── Invalid → "Key not recognized. Check your purchase email."
              └── [Buy a License] link → shell.openExternal(checkout URL)
```

### 2.3 Key Storage

- Location: `<userData>/license.json`
- Encryption: Electron's `safeStorage.encryptString()` / `decryptString()` — uses the OS keychain (macOS Keychain, Windows DPAPI, Linux libsecret). If `safeStorage.isEncryptionAvailable()` returns false (some Linux environments without libsecret), fall back to plain-text storage — acceptable for a $24 product that isn't a high-value piracy target.
- Schema:
  ```json
  {
    "encryptedKey": "<base64>",
    "productId": "fiction-linter",
    "validatedAt": "2026-04-16T00:00:00.000Z",
    "licenseeEmail": "user@example.com",
    "licenseeName": "Jane Author"
  }
  ```
- `validatedAt` is updated on each successful API check. If > 30 days stale, re-validate on next launch. This lets the app work fully offline between checks.

### 2.4 Validation API Call

Single HTTPS POST to LemonSqueezy:
```
POST https://api.lemonsqueezy.com/v1/licenses/validate
Body: { "license_key": "<key>", "instance_name": "<machine-id>" }
```

Response includes: `valid`, `license_key.status`, `meta.customer_name`, `meta.customer_email`.

The validation module does NOT embed any LemonSqueezy API key — the `/validate` endpoint is public and requires only the license key itself. No secrets in the binary.

### 2.5 Shared Module

File: `electron/licensing.js`

Exports:
- `readStoredLicense()` → `{ key, productId, validatedAt, email, name } | null`
- `storeLicense({ key, productId, email, name })` → void
- `clearLicense()` → void
- `validateLicenseKey(key, productId)` → `{ valid, email, name, error? }`
- `shouldRevalidate(validatedAt)` → boolean (true if > 30 days)

Product ID is a parameter, not a constant — the same module works for Focus Viewer and Arcwright by passing a different `productId`.

### 2.6 License Dialog Component

File: `src/components/LicenseDialog.jsx`

- Full-screen modal, rendered BEFORE the app shell (not inside it)
- Fields: license key (text input), error message area
- Buttons: [Activate], [Buy a License]
- No "skip" or "trial" — the app requires a valid key to use
- Branding: app name, version, publisher logo
- Renders on the current theme (reads data-theme from :root)

### 2.7 Deactivation

Menu item: Help → Deactivate License

- Calls `clearLicense()`
- Restarts the app (re-shows the license dialog)
- Use case: transferring the license to another machine

---

## 3. Cross-Platform Packaging

### 3.1 Build Targets

| Platform | Format | Signing | Architecture |
|----------|--------|---------|-------------|
| macOS | DMG | Apple Developer ($99/yr), signed + notarized | Universal (arm64 + x64) |
| Windows | NSIS installer (.exe) | Unsigned for v1.0 (add EV cert when revenue justifies $200-400/yr) | x64 |
| Linux | AppImage + .deb | None needed | x64 |

### 3.2 electron-builder Configuration

Add to `package.json` `build` section:
```json
{
  "win": {
    "target": [{ "target": "nsis", "arch": ["x64"] }],
    "icon": "build/icon.ico"
  },
  "linux": {
    "target": ["AppImage", "deb"],
    "category": "Office",
    "icon": "build/icon.png"
  },
  "mac": {
    "category": "public.app-category.productivity",
    "target": [{ "target": "dmg", "arch": ["arm64", "x64"] }],
    "identity": "<Apple Developer signing identity>",
    "notarize": {
      "teamId": "<Apple Team ID>"
    }
  },
  "publish": {
    "provider": "github",
    "owner": "wmiles81",
    "repo": "fiction-linter"
  }
}
```

### 3.3 App Icons

Three formats required:
- `build/icon.icns` — macOS (1024x1024 source, `iconutil` generates the `.icns`)
- `build/icon.ico` — Windows (256x256 multi-resolution)
- `build/icon.png` — Linux (512x512)

**Action needed:** provide or create a brand icon. If not available at implementation time, use a placeholder and swap before the first public build.

### 3.4 Build Scripts

Add to `package.json` `scripts`:
```json
{
  "dist:mac": "npm run build && electron-builder --mac",
  "dist:win": "npm run build && electron-builder --win",
  "dist:linux": "npm run build && electron-builder --linux",
  "dist:all": "npm run build && electron-builder --mac --win --linux"
}
```

### 3.5 CI/CD (Deferred)

Automated builds via GitHub Actions are deferred to post-v1.0. For the initial release, builds are run locally on the developer's machine. macOS builds must run on macOS (for signing/notarization). Windows builds can cross-compile from macOS via electron-builder. Linux builds can cross-compile from macOS.

---

## 4. Auto-Update

### 4.1 Mechanism

`electron-updater` (bundled with electron-builder) checks GitHub Releases for a newer version on each app launch.

### 4.2 Update Flow

```
App launches (after license check passes)
  │
  └── Background: autoUpdater.checkForUpdates()
        │
        ├── No update → nothing visible
        │
        └── Update available
              │
              ├── Download in background (progress silent)
              │
              └── Download complete → status bar message:
                    "Version X.Y.Z available — click to restart and update"
                    │
                    └── User clicks → autoUpdater.quitAndInstall()
```

### 4.3 Design Principles

- **Non-blocking**: update check + download happen in the background. Never interrupt writing.
- **No forced updates**: the user decides when to restart. They can dismiss and update later.
- **Status bar notification**: fits the existing information surface. No modal, no toast, no badge.
- **Graceful offline**: if the check fails (no internet), silently ignore. Try again next launch.

### 4.4 Implementation

File: `electron/updater.js`

```js
const { autoUpdater } = require('electron-updater');

function initAutoUpdater(mainWindow) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false; // user controls when

    autoUpdater.on('update-available', (info) => {
        // Optional: notify renderer that a download started
    });

    autoUpdater.on('update-downloaded', (info) => {
        mainWindow.webContents.send('update:ready', {
            version: info.version,
            releaseNotes: info.releaseNotes
        });
    });

    autoUpdater.checkForUpdates().catch(() => {
        // Offline or repo unreachable — silent, non-fatal
    });
}
```

Renderer listens via preload:
```js
onUpdateReady: (callback) => {
    ipcRenderer.on('update:ready', (_event, info) => callback(info));
    return () => ipcRenderer.removeListener('update:ready', ...);
}
```

### 4.5 Release Publishing Workflow

1. Bump version in `package.json`
2. `npm run dist:all` — produces signed/notarized binaries for all platforms
3. Create a GitHub Release tagged `vX.Y.Z`
4. Attach the platform binaries to the release
5. electron-updater's `latest.yml` / `latest-mac.yml` files are auto-generated by electron-builder and included in the release assets
6. Running apps check for updates on next launch and find the new version

### 4.6 Update Hosting Cost

GitHub Releases: $0 (free for public repos, free for private repos on any paid plan). Release assets are served via GitHub's CDN.

---

## 5. Polish Pass

### 5.1 About Dialog

Menu item: Fiction Linter → About Fiction Linter (macOS) / Help → About (Windows/Linux)

Content:
- App icon
- "Fiction Linter Desktop"
- Version: "v1.0.0"
- "Licensed to: [name from license]" (or "Unlicensed" if key cleared)
- Publisher: "Ocotillo Quill Press LLC"
- Links: Website, Support Email, GitHub (if public)
- Copyright line: "Copyright 2025 Ocotillo Quill Press LLC. All rights reserved."

### 5.2 Error Boundary

React error boundary wrapping the entire app shell. On unhandled render error:
- Shows a centered card: "Something went wrong"
- Stack trace (collapsed, expandable for bug reports)
- [Restart App] button that calls `window.location.reload()`
- Prevents the white-screen-of-death that currently results from any unhandled error

### 5.3 First-Run Experience

When no folder is open and no tabs exist (fresh install or after clearing all tabs):
- The editor area shows a centered welcome message:
  - "Welcome to Fiction Linter"
  - "Open a folder to start exploring your manuscript"
  - [Open Folder] button (calls handleChooseFolder)
  - Brief feature highlights (3-4 bullet points)

### 5.4 Version in Title Bar

Window title: `Fiction Linter Desktop v1.0.0` (appended via `BrowserWindow.setTitle` after the version is read from `package.json` or `app.getVersion()`).

### 5.5 Version Bump

`package.json` version: `0.0.1` → `1.0.0`

---

## 6. Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer Program | $99 | Annual |
| LemonSqueezy (free plan) | $0 | Monthly |
| LemonSqueezy per transaction | ~7% of sale price | Per sale |
| Windows EV Code Signing | $0 (deferred) | — |
| GitHub Releases hosting | $0 | — |
| **Total year-one fixed cost** | **$99** | |

At $24 average price and 100 sales in year one, LemonSqueezy fees = ~$170. Total first-year cost = ~$269.

---

## 7. What's NOT in v1.0

These are explicitly deferred to post-v1.0 releases:

- Manual text annotation (user-selected text + typed note)
- Chapter-scoped AI scan (scan only around cursor position)
- Annotation viewer panel (read `.annotation.md` inline)
- Batch Fix Later (multi-select findings)
- Mac App Store / Windows Store distribution
- CI/CD automated builds (GitHub Actions)
- Team/multi-seat licensing
- Trial / freemium mode

---

## 8. File Manifest

New files to create:

| File | Purpose |
|------|---------|
| `electron/licensing.js` | Shared license validation module (LemonSqueezy API) |
| `electron/licensing.test.js` | Unit tests for licensing module |
| `electron/updater.js` | Auto-update initialization via electron-updater |
| `src/components/LicenseDialog.jsx` | License key entry modal |
| `src/components/LicenseDialog.test.jsx` | License dialog tests |
| `src/components/AboutDialog.jsx` | About screen |
| `src/components/ErrorBoundary.jsx` | React error boundary |
| `src/components/WelcomeScreen.jsx` | First-run empty-state |
| `build/icon.icns` | macOS app icon |
| `build/icon.ico` | Windows app icon |
| `build/icon.png` | Linux app icon |

Files to modify:

| File | Changes |
|------|---------|
| `electron/main.js` | License check before window creation, auto-updater init, about/deactivate menu handlers |
| `electron/preload.js` | Expose license + update IPC channels |
| `electron/menu.js` | Add About, Deactivate License, Check for Updates menu items |
| `src/App.jsx` | Wrap in ErrorBoundary, conditionally show LicenseDialog or WelcomeScreen |
| `src/test/setup.js` | Stubs for new IPC methods |
| `package.json` | Version bump, win/linux build targets, publish config, electron-updater dep |

---

## 9. Implementation Order

1. **Licensing module + dialog** — gate the app behind a valid key
2. **Error boundary + welcome screen** — polish the empty/broken states
3. **About dialog + menu updates** — complete the chrome
4. **Auto-updater** — background update checks + status bar notification
5. **Cross-platform build config** — win/linux targets, icon placeholders
6. **macOS signing + notarization** — requires Apple Developer credentials
7. **Version bump to 1.0.0** — last commit before first release build
8. **Build + publish first release** — create GitHub Release with platform binaries

---

## 10. Success Criteria

v1.0 is shippable when:

- [ ] App launches with a license dialog if no valid key is stored
- [ ] Valid LemonSqueezy key activates the app and persists across restarts
- [ ] Invalid key shows a clear error message
- [ ] "Buy a License" opens the LemonSqueezy checkout page
- [ ] "Deactivate License" clears the key and re-shows the dialog
- [ ] App works fully offline after initial activation (30-day grace window)
- [ ] Auto-update detects a newer GitHub Release and offers to install
- [ ] About dialog shows version, licensee name, publisher
- [ ] Error boundary catches render errors without white-screening
- [ ] Welcome screen shows when no content is open
- [ ] macOS DMG installs without "unidentified developer" warning (signed + notarized)
- [ ] Windows NSIS installer produces a working installation
- [ ] Linux AppImage runs on Ubuntu 22.04+
- [ ] All existing tests pass (229+ currently)
- [ ] New licensing + UI tests pass
