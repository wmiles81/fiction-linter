/**
 * License key storage, encryption, validation, and revalidation timing.
 *
 * Uses Electron's safeStorage for encrypting the key at rest.
 * Falls back to plaintext storage when safeStorage encryption is unavailable.
 *
 * Designed to be product-agnostic: pass `productId` so the same module
 * works for Fiction Linter, Focus Viewer, Arcwright, etc.
 *
 * Electron APIs are accessed lazily (via getElectron()) so that tests can
 * inject mocks without needing Vitest to intercept CJS require calls.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const REVALIDATION_DAYS = 30;
const LICENSE_FILENAME = 'license.json';
const LEMONSQUEEZY_VALIDATE_URL = 'https://api.lemonsqueezy.com/v1/licenses/validate';

// Allows tests (and production code) to override the Electron dependency.
// In production this is populated lazily from require('electron').
let _electron = null;

function getElectron() {
    if (!_electron) {
        _electron = require('electron');
    }
    return _electron;
}

/**
 * Override the Electron module reference. Call this in tests before importing
 * the module, or use module._setElectron() after import.
 *
 * @param {{ app: object, safeStorage: object }} mock
 */
function _setElectron(mock) {
    _electron = mock;
}

function getLicensePath() {
    const { app } = getElectron();
    return path.join(app.getPath('userData'), LICENSE_FILENAME);
}

/**
 * Returns a stable, human-readable machine identifier.
 * Does not need to be globally unique — it's only used as an instance_name
 * label in LemonSqueezy's activation record.
 */
function machineId() {
    return `${os.hostname()}-${os.platform()}-${os.arch()}`;
}

/**
 * Read and decrypt the stored license.
 *
 * @returns {{ key: string, productId: string, validatedAt: string, email: string, name: string } | null}
 */
function readStoredLicense() {
    const licensePath = getLicensePath();
    let raw;
    try {
        raw = fs.readFileSync(licensePath, 'utf8');
    } catch {
        // File doesn't exist or isn't readable.
        return null;
    }

    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        // Corrupt JSON.
        return null;
    }

    const { safeStorage } = getElectron();
    let key;
    if (data.encryptedKey) {
        try {
            const buf = Buffer.from(data.encryptedKey, 'base64');
            key = safeStorage.decryptString(buf);
        } catch {
            return null;
        }
    } else if (data.plaintextKey) {
        key = data.plaintextKey;
    } else {
        return null;
    }

    return {
        key,
        productId: data.productId || null,
        validatedAt: data.validatedAt || null,
        email: data.email || null,
        name: data.name || null,
    };
}

/**
 * Encrypt and persist a license.
 *
 * @param {{ key: string, productId: string, email?: string, name?: string }} params
 */
function storeLicense({ key, productId, email = null, name = null }) {
    const licensePath = getLicensePath();
    const { safeStorage } = getElectron();

    let record;
    if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(key);
        record = {
            encryptedKey: encrypted.toString('base64'),
            productId,
            validatedAt: new Date().toISOString(),
            email,
            name,
        };
    } else {
        record = {
            plaintextKey: key,
            productId,
            validatedAt: new Date().toISOString(),
            email,
            name,
        };
    }

    fs.writeFileSync(licensePath, JSON.stringify(record, null, 2), 'utf8');
}

/**
 * Delete the stored license file.
 */
function clearLicense() {
    const licensePath = getLicensePath();
    try {
        fs.unlinkSync(licensePath);
    } catch {
        // Ignore if it doesn't exist.
    }
}

/**
 * Returns true if the license should be revalidated against the server.
 *
 * @param {string | null} validatedAt  ISO date string from the stored license
 * @returns {boolean}
 */
function shouldRevalidate(validatedAt) {
    if (!validatedAt) return true;
    const then = new Date(validatedAt);
    if (isNaN(then.getTime())) return true;
    const diffMs = Date.now() - then.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays > REVALIDATION_DAYS;
}

/**
 * Validate a license key against the LemonSqueezy API.
 *
 * The `/validate` endpoint is public — no API key embedded in the binary.
 *
 * @param {string} key
 * @param {string} productId  Used as part of the instance_name label.
 * @returns {Promise<{ valid: true, email: string, name: string } | { valid: false, error: string }>}
 */
async function validateLicenseKey(key, productId) {
    const instance_name = `${machineId()}-${productId}`;
    let response;
    try {
        response = await fetch(LEMONSQUEEZY_VALIDATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ license_key: key, instance_name }),
            signal: AbortSignal.timeout(15000),
        });
    } catch (err) {
        return { valid: false, error: `Network error: ${err.message}` };
    }

    let payload;
    try {
        payload = await response.json();
    } catch (err) {
        return { valid: false, error: `Invalid response: ${err.message}` };
    }

    if (!response.ok) {
        const msg = payload?.error || payload?.message || `HTTP ${response.status}`;
        return { valid: false, error: String(msg) };
    }

    // LemonSqueezy returns { valid: true/false, license_key: { ... }, meta: { ... } }
    if (!payload.valid) {
        const msg = payload?.error || 'License is not valid.';
        return { valid: false, error: String(msg) };
    }

    const email = payload?.meta?.customer_email || payload?.license_key?.email || null;
    const name = payload?.meta?.customer_name || payload?.license_key?.name || null;

    return { valid: true, email, name };
}

module.exports = {
    readStoredLicense,
    storeLicense,
    clearLicense,
    shouldRevalidate,
    validateLicenseKey,
    machineId,
    _setElectron,
};
