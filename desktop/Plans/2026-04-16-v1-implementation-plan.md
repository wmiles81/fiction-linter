# Fiction Linter Desktop v1.0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Fiction Linter Desktop as a paid one-time-purchase product with license validation, cross-platform packaging, auto-update, and commercial polish.

**Architecture:** LemonSqueezy handles payment + license key generation. The Electron main process validates keys against LemonSqueezy's public REST API and caches the result locally (encrypted via `safeStorage`). The renderer shows a blocking license dialog on first launch. Auto-update uses `electron-updater` against GitHub Releases. No new servers to deploy.

**Tech Stack:** Electron 34, React 18, electron-builder 26, electron-updater, LemonSqueezy REST API, Electron safeStorage API.

**Spec:** `desktop/Plans/2026-04-16-v1-commercial-release-spec.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `electron/licensing.js` | Read/write/validate license keys. Pure Node — no Electron UI. Uses `safeStorage` for encryption, `fetch` for LemonSqueezy API. Shared across products via `productId` param. |
| `electron/licensing.test.js` | Unit tests for licensing module (key storage, validation, revalidation timing) |
| `electron/updater.js` | Initialize `electron-updater`, wire events to renderer via IPC. ~30 lines. |
| `src/components/LicenseDialog.jsx` | Full-screen modal blocking app until valid key entered. Branded, themed. |
| `src/components/LicenseDialog.test.jsx` | Tests: renders fields, activate flow, error display, buy link |
| `src/components/AboutDialog.jsx` | About screen: version, licensee, publisher, links |
| `src/components/ErrorBoundary.jsx` | React error boundary wrapping the app shell |
| `src/components/WelcomeScreen.jsx` | First-run empty state with Open Folder CTA |
| `build/icon.png` | 1024x1024 source icon (provided by user) |
| `build/icon.icns` | macOS icon (generated from source) |
| `build/icon.ico` | Windows icon (generated from source) |

### Modified Files

| File | Changes |
|------|---------|
| `electron/main.js` | License gate before `createWindow`, auto-updater init after window, IPC handlers for license + update + about |
| `electron/preload.js` | Expose `validateLicense`, `activateLicense`, `deactivateLicense`, `getLicenseInfo`, `onUpdateReady`, `installUpdate` |
| `electron/menu.js` | Add About (macOS app menu), Deactivate License (Help), Check for Updates (Help) |
| `src/App.jsx` | Wrap in ErrorBoundary, show LicenseDialog when unlicensed, show WelcomeScreen when no content |
| `src/test/setup.js` | Stubs for all new IPC methods |
| `package.json` | Version 1.0.0, electron-updater dep, win/linux build targets, publish config, dist scripts |

---

## Task 1: Licensing Module (main process)

**Files:**
- Create: `electron/licensing.js`
- Create: `electron/licensing.test.js`

- [ ] **Step 1: Write failing tests for key storage**

Create `electron/licensing.test.js`:
```js
const { describe, it, expect, beforeEach, vi } = require('vitest');

// Mock Electron APIs — licensing.js runs in main process (Node/CJS)
// so we mock at the module level before requiring.
vi.mock('electron', () => ({
    app: { getPath: () => '/tmp/test-userdata' },
    safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (s) => Buffer.from(`enc:${s}`),
        decryptString: (buf) => buf.toString().replace('enc:', '')
    }
}));

const fs = require('fs');
const path = require('path');
const LICENSE_PATH = path.join('/tmp/test-userdata', 'license.json');

describe('licensing — storage', () => {
    beforeEach(() => {
        if (fs.existsSync(LICENSE_PATH)) fs.unlinkSync(LICENSE_PATH);
    });

    it('readStoredLicense returns null when no file exists', () => {
        const { readStoredLicense } = require('./licensing');
        expect(readStoredLicense()).toBeNull();
    });

    it('storeLicense writes and readStoredLicense reads back', () => {
        const { storeLicense, readStoredLicense } = require('./licensing');
        storeLicense({
            key: 'AAAA-BBBB-CCCC-DDDD',
            productId: 'fiction-linter',
            email: 'test@example.com',
            name: 'Test User'
        });
        const stored = readStoredLicense();
        expect(stored.key).toBe('AAAA-BBBB-CCCC-DDDD');
        expect(stored.productId).toBe('fiction-linter');
        expect(stored.email).toBe('test@example.com');
    });

    it('clearLicense removes the stored key', () => {
        const { storeLicense, clearLicense, readStoredLicense } = require('./licensing');
        storeLicense({ key: 'x', productId: 'x', email: 'x', name: 'x' });
        clearLicense();
        expect(readStoredLicense()).toBeNull();
    });

    it('shouldRevalidate returns true when validatedAt is > 30 days old', () => {
        const { shouldRevalidate } = require('./licensing');
        const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
        expect(shouldRevalidate(old)).toBe(true);
    });

    it('shouldRevalidate returns false when validatedAt is recent', () => {
        const { shouldRevalidate } = require('./licensing');
        expect(shouldRevalidate(new Date().toISOString())).toBe(false);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd desktop && npx vitest run electron/licensing.test.js`
Expected: FAIL — `./licensing` module does not exist yet.

- [ ] **Step 3: Implement the licensing module**

Create `electron/licensing.js`:
```js
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const LICENSE_FILE = 'license.json';
const REVALIDATION_DAYS = 30;

function licensePath() {
    return path.join(app.getPath('userData'), LICENSE_FILE);
}

function readStoredLicense() {
    const filePath = licensePath();
    if (!fs.existsSync(filePath)) return null;
    try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const canEncrypt = safeStorage.isEncryptionAvailable();
        let key;
        if (canEncrypt && raw.encryptedKey) {
            key = safeStorage.decryptString(Buffer.from(raw.encryptedKey, 'base64'));
        } else {
            key = raw.plaintextKey || null;
        }
        if (!key) return null;
        return {
            key,
            productId: raw.productId || '',
            validatedAt: raw.validatedAt || null,
            email: raw.email || '',
            name: raw.name || ''
        };
    } catch {
        return null;
    }
}

function storeLicense({ key, productId, email, name }) {
    const canEncrypt = safeStorage.isEncryptionAvailable();
    const payload = {
        productId,
        email,
        name,
        validatedAt: new Date().toISOString()
    };
    if (canEncrypt) {
        payload.encryptedKey = safeStorage.encryptString(key).toString('base64');
    } else {
        payload.plaintextKey = key;
    }
    fs.writeFileSync(licensePath(), JSON.stringify(payload, null, 2), 'utf8');
}

function clearLicense() {
    const filePath = licensePath();
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function shouldRevalidate(validatedAt) {
    if (!validatedAt) return true;
    const age = Date.now() - new Date(validatedAt).getTime();
    return age > REVALIDATION_DAYS * 24 * 60 * 60 * 1000;
}

async function validateLicenseKey(key, productId) {
    if (!key) return { valid: false, error: 'No key provided.' };
    try {
        const response = await fetch(
            'https://api.lemonsqueezy.com/v1/licenses/validate',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    license_key: key,
                    instance_name: `${productId}-${machineId()}`
                }),
                signal: AbortSignal.timeout(15000)
            }
        );
        const data = await response.json();
        if (data.valid) {
            return {
                valid: true,
                email: data.meta?.customer_email || '',
                name: data.meta?.customer_name || ''
            };
        }
        return {
            valid: false,
            error: data.error || data.license_key?.status || 'Key not recognized.'
        };
    } catch (err) {
        return { valid: false, error: `Network error: ${err.message}` };
    }
}

function machineId() {
    const os = require('os');
    return `${os.hostname()}-${os.platform()}-${os.arch()}`;
}

module.exports = {
    readStoredLicense,
    storeLicense,
    clearLicense,
    shouldRevalidate,
    validateLicenseKey
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd desktop && npx vitest run electron/licensing.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add electron/licensing.js electron/licensing.test.js
git commit -m "feat: licensing module with key storage, validation, and revalidation"
```

---

## Task 2: License IPC Handlers + Preload

**Files:**
- Modify: `electron/main.js`
- Modify: `electron/preload.js`
- Modify: `src/test/setup.js`

- [ ] **Step 1: Add license IPC handlers to main.js**

Add near the top of `main.js` (after existing requires):
```js
const { readStoredLicense, storeLicense, clearLicense, shouldRevalidate, validateLicenseKey } = require('./licensing');
```

Add IPC handlers (before `app.whenReady`):
```js
ipcMain.handle('license:get', async () => {
    const stored = readStoredLicense();
    if (!stored) return { licensed: false };
    return {
        licensed: true,
        email: stored.email,
        name: stored.name,
        needsRevalidation: shouldRevalidate(stored.validatedAt)
    };
});

ipcMain.handle('license:validate', async (_event, key) => {
    const result = await validateLicenseKey(key, 'fiction-linter');
    if (result.valid) {
        storeLicense({
            key,
            productId: 'fiction-linter',
            email: result.email,
            name: result.name
        });
    }
    return result;
});

ipcMain.handle('license:revalidate', async () => {
    const stored = readStoredLicense();
    if (!stored) return { valid: false, error: 'No stored key.' };
    const result = await validateLicenseKey(stored.key, stored.productId);
    if (result.valid) {
        storeLicense({ ...stored, email: result.email, name: result.name });
    }
    return result;
});

ipcMain.handle('license:deactivate', async () => {
    clearLicense();
    return { ok: true };
});
```

- [ ] **Step 2: Add license methods to preload.js**

Add to the `contextBridge.exposeInMainWorld('api', { ... })` block:
```js
getLicenseInfo: () => ipcRenderer.invoke('license:get'),
validateLicense: (key) => ipcRenderer.invoke('license:validate', key),
revalidateLicense: () => ipcRenderer.invoke('license:revalidate'),
deactivateLicense: () => ipcRenderer.invoke('license:deactivate'),
```

- [ ] **Step 3: Add stubs to test setup**

Add to `window.api` in `src/test/setup.js`:
```js
getLicenseInfo: async () => ({ licensed: true, email: 'test@test.com', name: 'Test', needsRevalidation: false }),
validateLicense: async () => ({ valid: true, email: 'test@test.com', name: 'Test' }),
revalidateLicense: async () => ({ valid: true }),
deactivateLicense: async () => ({ ok: true }),
```

- [ ] **Step 4: Run full test suite**

Run: `cd desktop && npm test`
Expected: All existing tests pass (229+)

- [ ] **Step 5: Commit**

```bash
git add electron/main.js electron/preload.js src/test/setup.js
git commit -m "feat: license IPC handlers + preload API + test stubs"
```

---

## Task 3: License Dialog Component

**Files:**
- Create: `src/components/LicenseDialog.jsx`
- Create: `src/components/LicenseDialog.test.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing tests for the license dialog**

Create `src/components/LicenseDialog.test.jsx`:
```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LicenseDialog from './LicenseDialog';

describe('LicenseDialog', () => {
    beforeEach(() => {
        window.api.validateLicense = vi.fn(async () => ({
            valid: true, email: 'a@b.com', name: 'Author'
        }));
    });

    it('renders a key input and activate button', () => {
        render(<LicenseDialog onActivated={() => {}} />);
        expect(screen.getByLabelText(/license key/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /activate/i })).toBeInTheDocument();
    });

    it('calls onActivated after successful validation', async () => {
        const onActivated = vi.fn();
        const user = userEvent.setup();
        render(<LicenseDialog onActivated={onActivated} />);
        await user.type(screen.getByLabelText(/license key/i), 'AAAA-BBBB');
        await user.click(screen.getByRole('button', { name: /activate/i }));
        expect(window.api.validateLicense).toHaveBeenCalledWith('AAAA-BBBB');
        expect(onActivated).toHaveBeenCalled();
    });

    it('shows an error on invalid key', async () => {
        window.api.validateLicense = vi.fn(async () => ({
            valid: false, error: 'Key not recognized.'
        }));
        const user = userEvent.setup();
        render(<LicenseDialog onActivated={() => {}} />);
        await user.type(screen.getByLabelText(/license key/i), 'BAD-KEY');
        await user.click(screen.getByRole('button', { name: /activate/i }));
        expect(screen.getByText(/key not recognized/i)).toBeInTheDocument();
    });

    it('has a buy link that opens externally', () => {
        render(<LicenseDialog onActivated={() => {}} />);
        expect(screen.getByRole('button', { name: /buy/i })).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd desktop && npx vitest run src/components/LicenseDialog.test.jsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the LicenseDialog component**

Create `src/components/LicenseDialog.jsx`:
```jsx
import { useState } from 'react';

const CHECKOUT_URL = 'https://ocotilloquillpress.lemonsqueezy.com/buy/fiction-linter';

function LicenseDialog({ onActivated }) {
    const [key, setKey] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleActivate = async () => {
        if (!key.trim()) {
            setError('Please enter a license key.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const result = await window.api.validateLicense(key.trim());
            if (result.valid) {
                onActivated({ email: result.email, name: result.name });
            } else {
                setError(result.error || 'Key not recognized. Check your purchase email.');
            }
        } catch (err) {
            setError(`Validation failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleBuy = () => {
        window.api.openExternal?.(CHECKOUT_URL);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleActivate();
    };

    return (
        <div className="license-backdrop">
            <div className="license-card">
                <h1 className="license-title">Fiction Linter</h1>
                <p className="license-subtitle">Desktop Studio</p>
                <p className="license-publisher">Ocotillo Quill Press LLC</p>

                <div className="license-form">
                    <label htmlFor="license-key-input">License Key</label>
                    <input
                        id="license-key-input"
                        type="text"
                        value={key}
                        onChange={e => setKey(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                        disabled={loading}
                        autoFocus
                    />
                    {error ? <p className="license-error">{error}</p> : null}
                </div>

                <div className="license-actions">
                    <button
                        type="button"
                        className="primary-button"
                        onClick={handleActivate}
                        disabled={loading || !key.trim()}
                    >
                        {loading ? 'Validating...' : 'Activate'}
                    </button>
                    <button
                        type="button"
                        className="ghost-button"
                        onClick={handleBuy}
                        aria-label="Buy a license"
                    >
                        Buy a License
                    </button>
                </div>
            </div>
        </div>
    );
}

export default LicenseDialog;
```

- [ ] **Step 4: Add CSS for the license dialog**

Add to `src/styles.css`:
```css
.license-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: grid;
    place-items: center;
    background: radial-gradient(circle at top left, var(--bg-2), var(--bg-1) 55%, var(--bg-3) 100%);
}

.license-card {
    width: 400px;
    max-width: 90vw;
    padding: 40px;
    background: var(--surface-strong, #ffffff);
    border: 1px solid var(--border, #d3d5da);
    border-radius: 16px;
    box-shadow: var(--shadow);
    text-align: center;
}

.license-title {
    font-family: 'Fraunces', serif;
    font-size: 28px;
    margin: 0 0 4px;
    color: var(--ink);
}

.license-subtitle {
    font-size: 14px;
    color: var(--muted);
    margin: 0 0 4px;
}

.license-publisher {
    font-size: 12px;
    color: var(--muted);
    margin: 0 0 28px;
    opacity: 0.7;
}

.license-form {
    text-align: left;
    margin-bottom: 20px;
}

.license-form label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 6px;
    color: var(--ink);
}

.license-form input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-family: 'SF Mono', 'Menlo', monospace;
    font-size: 14px;
    letter-spacing: 0.05em;
    color: var(--ink);
    background: var(--surface-strong);
}

.license-form input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}

.license-error {
    margin-top: 8px;
    font-size: 13px;
    color: var(--g-danger, #b33a3a);
}

.license-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
```

- [ ] **Step 5: Run tests**

Run: `cd desktop && npx vitest run src/components/LicenseDialog.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/LicenseDialog.jsx src/components/LicenseDialog.test.jsx src/styles.css
git commit -m "feat: license dialog component with activation flow"
```

---

## Task 4: Wire License Gate into App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add license state + conditional render**

At the top of `App()`, add:
```js
const [licenseState, setLicenseState] = React.useState('checking'); // 'checking' | 'licensed' | 'unlicensed'
const [licenseInfo, setLicenseInfo] = React.useState(null);
```

Add a useEffect that checks on mount:
```js
useEffect(() => {
    (async () => {
        const info = await window.api.getLicenseInfo();
        if (info.licensed) {
            if (info.needsRevalidation) {
                const result = await window.api.revalidateLicense();
                if (!result.valid) {
                    setLicenseState('unlicensed');
                    return;
                }
            }
            setLicenseInfo({ email: info.email, name: info.name });
            setLicenseState('licensed');
        } else {
            setLicenseState('unlicensed');
        }
    })();
}, []);
```

At the top of the `return` block, before the existing `<div className="app-shell">`:
```jsx
if (licenseState === 'checking') {
    return null; // or a minimal loading spinner
}
if (licenseState === 'unlicensed') {
    return (
        <LicenseDialog onActivated={(info) => {
            setLicenseInfo(info);
            setLicenseState('licensed');
        }} />
    );
}
```

- [ ] **Step 2: Import LicenseDialog**

Add to imports:
```js
import LicenseDialog from './components/LicenseDialog';
```

- [ ] **Step 3: Run full test suite**

Run: `cd desktop && npm test`
Expected: All tests pass. The test setup stubs `getLicenseInfo` to return `{ licensed: true }`, so the gate is transparent in tests.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: license gate blocks app until valid key is entered"
```

---

## Task 5: Error Boundary + Welcome Screen

**Files:**
- Create: `src/components/ErrorBoundary.jsx`
- Create: `src/components/WelcomeScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create ErrorBoundary**

```jsx
import { Component } from 'react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary">
                    <h1>Something went wrong</h1>
                    <p>The app encountered an unexpected error.</p>
                    <details>
                        <summary>Error details</summary>
                        <pre>{this.state.error?.stack || this.state.error?.message || 'Unknown error'}</pre>
                    </details>
                    <button
                        type="button"
                        className="primary-button"
                        onClick={() => window.location.reload()}
                    >
                        Restart App
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
```

- [ ] **Step 2: Create WelcomeScreen**

```jsx
function WelcomeScreen({ onOpenFolder }) {
    return (
        <div className="welcome-screen">
            <h2>Welcome to Fiction Linter</h2>
            <p>Open a folder to start exploring your manuscript.</p>
            <ul className="welcome-features">
                <li>Deterministic pattern linting for cliches, weak phrasing, and AI tells</li>
                <li>AI-powered scan for show-vs-tell and emotional telling</li>
                <li>Fix now or fix later with annotation logging</li>
                <li>Import .docx and .gdoc files directly</li>
            </ul>
            <button type="button" className="primary-button" onClick={onOpenFolder}>
                Open Folder
            </button>
        </div>
    );
}

export default WelcomeScreen;
```

- [ ] **Step 3: Wire into App.jsx**

Import both, wrap the app-shell in ErrorBoundary, show WelcomeScreen when no tabs and no rootPath:

In the return block, after the license check, before the `<div className="app-shell">`:
```jsx
return (
    <ErrorBoundary>
        <div className="app-shell">
            ...
            <main className="right-panel">
                <TabBar ... />
                {tabs.length === 0 && !rootPath ? (
                    <WelcomeScreen onOpenFolder={handleChooseFolder} />
                ) : (
                    <Editor ... />
                )}
            </main>
            ...
        </div>
    </ErrorBoundary>
);
```

- [ ] **Step 4: Add CSS for error boundary and welcome screen**

```css
.error-boundary {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    text-align: center;
    padding: 40px;
    color: var(--ink);
}

.error-boundary details {
    margin: 16px 0;
    max-width: 600px;
    text-align: left;
}

.error-boundary pre {
    font-size: 11px;
    overflow-x: auto;
    background: rgba(0,0,0,0.05);
    padding: 12px;
    border-radius: 8px;
}

.welcome-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    text-align: center;
    padding: 40px;
    color: var(--muted);
}

.welcome-screen h2 {
    font-family: 'Fraunces', serif;
    font-size: 24px;
    color: var(--ink);
    margin-bottom: 8px;
}

.welcome-features {
    text-align: left;
    margin: 16px 0 24px;
    font-size: 14px;
    line-height: 1.6;
    list-style: disc;
    padding-left: 20px;
}
```

- [ ] **Step 5: Run tests + commit**

Run: `cd desktop && npm test`
Expected: All pass

```bash
git add src/components/ErrorBoundary.jsx src/components/WelcomeScreen.jsx src/App.jsx src/styles.css
git commit -m "feat: error boundary wraps app, welcome screen for empty state"
```

---

## Task 6: About Dialog + Menu Updates

**Files:**
- Create: `src/components/AboutDialog.jsx`
- Modify: `electron/menu.js`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create AboutDialog**

```jsx
function AboutDialog({ onClose, licenseInfo, version }) {
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="about-card" onClick={e => e.stopPropagation()}>
                <img src="/icon.png" alt="Fiction Linter" className="about-icon" />
                <h2>Fiction Linter Desktop</h2>
                <p className="about-version">v{version}</p>
                <p className="about-licensee">
                    {licenseInfo?.name
                        ? `Licensed to: ${licenseInfo.name}`
                        : 'Unlicensed'}
                </p>
                <p className="about-publisher">Ocotillo Quill Press LLC</p>
                <p className="about-copyright">Copyright 2025 Ocotillo Quill Press LLC. All rights reserved.</p>
                <button type="button" className="ghost-button" onClick={onClose}>Close</button>
            </div>
        </div>
    );
}

export default AboutDialog;
```

- [ ] **Step 2: Add menu items to menu.js**

In the Help submenu, add before the existing documentation item:
```js
{
    label: 'About Fiction Linter',
    click: () => sendToRenderer('menu:action', { action: 'show-about' })
},
{
    label: 'Check for Updates…',
    click: () => sendToRenderer('menu:action', { action: 'check-updates' })
},
{
    label: 'Deactivate License…',
    click: () => sendToRenderer('menu:action', { action: 'deactivate-license' })
},
{ type: 'separator' },
```

On macOS, replace the built-in `{ role: 'about' }` with:
```js
{
    label: 'About Fiction Linter',
    click: () => sendToRenderer('menu:action', { action: 'show-about' })
},
```

- [ ] **Step 3: Handle new menu actions in App.jsx**

In the `onMenuAction` switch statement, add cases:
```js
case 'show-about':
    setShowAbout(true);
    break;
case 'deactivate-license':
    if (confirm('Deactivate your license? The app will restart.')) {
        await window.api.deactivateLicense();
        window.location.reload();
    }
    break;
case 'check-updates':
    setStatus('Checking for updates...');
    break;
```

Add state: `const [showAbout, setShowAbout] = React.useState(false);`

Render the dialog conditionally alongside the SettingsDialog:
```jsx
{showAbout ? (
    <AboutDialog
        onClose={() => setShowAbout(false)}
        licenseInfo={licenseInfo}
        version={app_version}
    />
) : null}
```

- [ ] **Step 4: Run tests + commit**

```bash
git add src/components/AboutDialog.jsx electron/menu.js src/App.jsx src/styles.css
git commit -m "feat: about dialog, deactivate license, check for updates menu items"
```

---

## Task 7: Auto-Updater

**Files:**
- Create: `electron/updater.js`
- Modify: `electron/main.js`
- Modify: `electron/preload.js`
- Modify: `src/App.jsx`
- Modify: `package.json`

- [ ] **Step 1: Install electron-updater**

```bash
cd desktop && npm install electron-updater
```

- [ ] **Step 2: Create updater module**

Create `electron/updater.js`:
```js
const { autoUpdater } = require('electron-updater');

function initAutoUpdater(mainWindow) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.logger = null; // suppress default logging

    autoUpdater.on('update-downloaded', (info) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update:ready', {
                version: info.version
            });
        }
    });

    autoUpdater.checkForUpdates().catch(() => {
        // Offline or repo unreachable — silent, non-fatal
    });
}

function installUpdate() {
    autoUpdater.quitAndInstall(false, true);
}

module.exports = { initAutoUpdater, installUpdate };
```

- [ ] **Step 3: Wire into main.js**

After `createWindow()` in `app.whenReady()`:
```js
const { initAutoUpdater } = require('./updater');
// Only auto-update in production (packaged) builds
if (app.isPackaged) {
    initAutoUpdater(mainWindow);
}
```

Add IPC handler:
```js
ipcMain.handle('update:install', async () => {
    const { installUpdate } = require('./updater');
    installUpdate();
});
```

- [ ] **Step 4: Add preload methods**

```js
onUpdateReady: (callback) => {
    const handler = (_event, info) => callback(info);
    ipcRenderer.on('update:ready', handler);
    return () => ipcRenderer.removeListener('update:ready', handler);
},
installUpdate: () => ipcRenderer.invoke('update:install'),
```

- [ ] **Step 5: Handle update notification in App.jsx**

Add state: `const [updateAvailable, setUpdateAvailable] = React.useState(null);`

Add effect:
```js
useEffect(() => {
    if (!window.api?.onUpdateReady) return;
    const unsub = window.api.onUpdateReady((info) => {
        setUpdateAvailable(info);
        setStatus(`Version ${info.version} available — click update notification to install.`);
    });
    return unsub;
}, []);
```

- [ ] **Step 6: Add stubs to test setup**

```js
onUpdateReady: () => () => {},
installUpdate: async () => {},
```

- [ ] **Step 7: Add publish config to package.json**

In the `build` section:
```json
"publish": {
    "provider": "github",
    "owner": "wmiles81",
    "repo": "fiction-linter"
}
```

- [ ] **Step 8: Run tests + commit**

```bash
git add electron/updater.js electron/main.js electron/preload.js src/App.jsx src/test/setup.js package.json
git commit -m "feat: auto-update via electron-updater + GitHub Releases"
```

---

## Task 8: Cross-Platform Build Config + Icons

**Files:**
- Modify: `package.json`
- Create: `build/icon.png`
- Create: `build/icon.icns` (generated)
- Create: `build/icon.ico` (generated)

- [ ] **Step 1: Save the user-provided logo as build/icon.png**

The user provided a 1024x1024 logo image. Save it to `build/icon.png`.

- [ ] **Step 2: Generate platform-specific icons**

macOS:
```bash
mkdir -p build/icon.iconset
sips -z 16 16 build/icon.png --out build/icon.iconset/icon_16x16.png
sips -z 32 32 build/icon.png --out build/icon.iconset/icon_16x16@2x.png
sips -z 32 32 build/icon.png --out build/icon.iconset/icon_32x32.png
sips -z 64 64 build/icon.png --out build/icon.iconset/icon_32x32@2x.png
sips -z 128 128 build/icon.png --out build/icon.iconset/icon_128x128.png
sips -z 256 256 build/icon.png --out build/icon.iconset/icon_128x128@2x.png
sips -z 256 256 build/icon.png --out build/icon.iconset/icon_256x256.png
sips -z 512 512 build/icon.png --out build/icon.iconset/icon_256x256@2x.png
sips -z 512 512 build/icon.png --out build/icon.iconset/icon_512x512.png
sips -z 1024 1024 build/icon.png --out build/icon.iconset/icon_512x512@2x.png
iconutil -c icns build/icon.iconset -o build/icon.icns
rm -rf build/icon.iconset
```

Windows (requires ImageMagick or `png-to-ico` npm package):
```bash
npx png-to-ico build/icon.png > build/icon.ico
```

- [ ] **Step 3: Update package.json build config**

Add `win` and `linux` sections, update `mac`, add build scripts:
```json
{
  "scripts": {
    "dist:mac": "npm run build && electron-builder --mac",
    "dist:win": "npm run build && electron-builder --win",
    "dist:linux": "npm run build && electron-builder --linux",
    "dist:all": "npm run build && electron-builder --mac --win --linux"
  },
  "build": {
    "appId": "com.ocotilloquill.fictionlinter.desktop",
    "productName": "Fiction Linter",
    "directories": { "output": "release" },
    "files": ["electron/**/*", "dist/**/*", "package.json"],
    "extraResources": [{
      "from": "../resources/spe_defaults",
      "to": "spe_defaults",
      "filter": ["**/*.yaml"]
    }],
    "mac": {
      "category": "public.app-category.productivity",
      "target": [{ "target": "dmg", "arch": ["arm64", "x64"] }],
      "icon": "build/icon.icns",
      "identity": null
    },
    "win": {
      "target": [{ "target": "nsis", "arch": ["x64"] }],
      "icon": "build/icon.ico"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "category": "Office",
      "icon": "build/icon.png"
    },
    "publish": {
      "provider": "github",
      "owner": "wmiles81",
      "repo": "fiction-linter"
    }
  }
}
```

Note: `"identity": null` remains until the user has the Apple Developer signing identity. Replace with the actual identity string before the first signed build.

- [ ] **Step 4: Commit**

```bash
git add build/ package.json
git commit -m "feat: cross-platform build config + app icons"
```

---

## Task 9: Version Bump + Window Title

**Files:**
- Modify: `package.json`
- Modify: `electron/main.js`

- [ ] **Step 1: Bump version to 1.0.0**

In `package.json`:
```json
"version": "1.0.0"
```

- [ ] **Step 2: Set window title to include version**

In `createWindow()` in `main.js`, after the window is created:
```js
window.setTitle(`Fiction Linter Desktop v${app.getVersion()}`);
```

- [ ] **Step 3: Run full test suite**

Run: `cd desktop && npm test`
Expected: All tests pass (240+ at this point)

- [ ] **Step 4: Commit**

```bash
git add package.json electron/main.js
git commit -m "release: version bump to 1.0.0"
```

---

## Task 10: Integration Verification

This task has no code changes — it's a manual verification checklist run against the dev build before the first production build.

- [ ] **Step 1: Fresh-install test**

Delete `<userData>/license.json` (if present). Launch `npm run dev`.
Expected: License dialog appears. App is blocked.

- [ ] **Step 2: Invalid key test**

Enter `INVALID-KEY-1234`. Click Activate.
Expected: Error message "Key not recognized."

- [ ] **Step 3: Valid key test (requires a LemonSqueezy test key)**

If LemonSqueezy is set up: enter a valid test key.
Expected: App activates. License stored. App opens normally.
If LemonSqueezy is not yet set up: skip — this is gated on the user's setup.

- [ ] **Step 4: Restart persistence test**

Quit and relaunch.
Expected: App opens directly (no license dialog). Cached validation < 30 days.

- [ ] **Step 5: Deactivation test**

Help → Deactivate License → confirm.
Expected: App restarts with the license dialog.

- [ ] **Step 6: About dialog test**

Help → About Fiction Linter.
Expected: Shows version, licensee name, publisher.

- [ ] **Step 7: Error boundary test**

In DevTools console, type: `document.querySelector('.app-shell').__reactFiber$.return.stateNode.setState({error: new Error('test')})`
Expected: Error boundary catches and shows "Something went wrong" with stack.

- [ ] **Step 8: Welcome screen test**

Close all tabs, ensure no folder is open.
Expected: Welcome screen with Open Folder button.

- [ ] **Step 9: Build test**

Run: `npm run dist:mac` (or `dist:win`/`dist:linux` depending on current platform).
Expected: Produces a working installer in `release/`.
