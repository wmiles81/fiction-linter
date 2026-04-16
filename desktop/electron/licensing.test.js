import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TEST_USERDATA = '/tmp/test-licensing-userdata';

// The Electron mock — injected via _setElectron() before tests run.
// This avoids the CJS-require / vi.mock interop issue where vi.mock only
// intercepts ESM imports, not CJS require() calls from the main-process files.
const ELECTRON_MOCK = {
    app: { getPath: () => TEST_USERDATA },
    safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (s) => Buffer.from(`enc:${s}`),
        decryptString: (buf) => buf.toString().replace('enc:', ''),
    },
};

// Import the module and inject the mock immediately. The module caches the
// injected reference, so all tests share the same mock (the path is constant).
import * as licensing from './licensing.js';
licensing._setElectron(ELECTRON_MOCK);

const LICENSE_PATH = path.join(TEST_USERDATA, 'license.json');

beforeAll(() => {
    fs.mkdirSync(TEST_USERDATA, { recursive: true });
});

afterAll(() => {
    try { fs.rmSync(TEST_USERDATA, { recursive: true, force: true }); } catch { /* ignore */ }
});

beforeEach(() => {
    // Remove any license file left by a previous test.
    try { fs.unlinkSync(LICENSE_PATH); } catch { /* ignore */ }
});

// ---------------------------------------------------------------------------
// readStoredLicense
// ---------------------------------------------------------------------------

describe('readStoredLicense', () => {
    it('returns null when no license file exists', () => {
        const result = licensing.readStoredLicense();
        expect(result).toBeNull();
    });

    it('returns null for a corrupt / non-JSON file', () => {
        fs.writeFileSync(LICENSE_PATH, 'this is not json', 'utf8');
        const result = licensing.readStoredLicense();
        expect(result).toBeNull();
    });

    it('returns null for JSON that has neither encryptedKey nor plaintextKey', () => {
        fs.writeFileSync(
            LICENSE_PATH,
            JSON.stringify({ productId: 'fl', validatedAt: new Date().toISOString() }),
            'utf8'
        );
        const result = licensing.readStoredLicense();
        expect(result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// storeLicense / readStoredLicense round-trip
// ---------------------------------------------------------------------------

describe('storeLicense + readStoredLicense', () => {
    it('writes and reads back a license correctly', () => {
        licensing.storeLicense({
            key: 'TEST-KEY-1234',
            productId: 'fiction-linter',
            email: 'user@example.com',
            name: 'Jane Doe',
        });

        const result = licensing.readStoredLicense();
        expect(result).not.toBeNull();
        expect(result.key).toBe('TEST-KEY-1234');
        expect(result.productId).toBe('fiction-linter');
        expect(result.email).toBe('user@example.com');
        expect(result.name).toBe('Jane Doe');
        expect(result.validatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('stores key encrypted (encryptedKey field, not plaintextKey)', () => {
        licensing.storeLicense({ key: 'MY-SECRET-KEY', productId: 'fl' });

        const raw = JSON.parse(fs.readFileSync(LICENSE_PATH, 'utf8'));
        expect(raw.encryptedKey).toBeDefined();
        expect(raw.plaintextKey).toBeUndefined();
        // The stored base64 value must not be the bare key.
        const decodedRaw = Buffer.from(raw.encryptedKey, 'base64').toString();
        expect(decodedRaw).not.toBe('MY-SECRET-KEY');
    });

    it('falls back to plaintextKey when encryption is not available', () => {
        // Temporarily swap in a mock where encryption is unavailable.
        const noEncryptMock = {
            app: { getPath: () => TEST_USERDATA },
            safeStorage: { isEncryptionAvailable: () => false },
        };
        licensing._setElectron(noEncryptMock);
        try {
            licensing.storeLicense({ key: 'PLAIN-KEY', productId: 'fl' });
            const raw = JSON.parse(fs.readFileSync(LICENSE_PATH, 'utf8'));
            expect(raw.plaintextKey).toBe('PLAIN-KEY');
            expect(raw.encryptedKey).toBeUndefined();

            // readStoredLicense should still return the key.
            const result = licensing.readStoredLicense();
            expect(result).not.toBeNull();
            expect(result.key).toBe('PLAIN-KEY');
        } finally {
            licensing._setElectron(ELECTRON_MOCK);
        }
    });
});

// ---------------------------------------------------------------------------
// clearLicense
// ---------------------------------------------------------------------------

describe('clearLicense', () => {
    it('removes the stored license file', () => {
        licensing.storeLicense({ key: 'K', productId: 'fl' });
        expect(licensing.readStoredLicense()).not.toBeNull();

        licensing.clearLicense();
        expect(licensing.readStoredLicense()).toBeNull();
        expect(fs.existsSync(LICENSE_PATH)).toBe(false);
    });

    it('does not throw when no file exists', () => {
        expect(() => licensing.clearLicense()).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// shouldRevalidate
// ---------------------------------------------------------------------------

describe('shouldRevalidate', () => {
    it('returns true for a timestamp older than 30 days', () => {
        const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
        expect(licensing.shouldRevalidate(old)).toBe(true);
    });

    it('returns false for a recent timestamp (today)', () => {
        const recent = new Date().toISOString();
        expect(licensing.shouldRevalidate(recent)).toBe(false);
    });

    it('returns false for a timestamp 29 days ago', () => {
        const twentyNine = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString();
        expect(licensing.shouldRevalidate(twentyNine)).toBe(false);
    });

    it('returns true when validatedAt is null', () => {
        expect(licensing.shouldRevalidate(null)).toBe(true);
    });

    it('returns true when validatedAt is an invalid date string', () => {
        expect(licensing.shouldRevalidate('not-a-date')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// machineId
// ---------------------------------------------------------------------------

describe('machineId', () => {
    it('includes hostname, platform, and arch', () => {
        const id = licensing.machineId();
        expect(id).toContain(os.hostname());
        expect(id).toContain(os.platform());
        expect(id).toContain(os.arch());
    });
});

// ---------------------------------------------------------------------------
// validateLicenseKey (fetch mocked)
// ---------------------------------------------------------------------------

describe('validateLicenseKey', () => {
    const realFetch = global.fetch;

    beforeEach(() => { global.fetch = vi.fn(); });
    afterEach(() => { global.fetch = realFetch; });

    it('returns { valid: true, email, name } on a successful response', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                valid: true,
                meta: { customer_email: 'buyer@example.com', customer_name: 'Bob' },
            }),
        });

        const result = await licensing.validateLicenseKey('VALID-KEY', 'fiction-linter');
        expect(result.valid).toBe(true);
        expect(result.email).toBe('buyer@example.com');
        expect(result.name).toBe('Bob');
    });

    it('returns { valid: false, error } when the API says the key is invalid', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ valid: false, error: 'License key not found.' }),
        });

        const result = await licensing.validateLicenseKey('BAD-KEY', 'fiction-linter');
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/not found/i);
    });

    it('returns { valid: false, error } on HTTP error responses', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 422,
            json: async () => ({ error: 'Unprocessable Entity' }),
        });

        const result = await licensing.validateLicenseKey('BAD-KEY', 'fiction-linter');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Unprocessable Entity');
    });

    it('returns { valid: false, error } on network failure', async () => {
        global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));

        const result = await licensing.validateLicenseKey('ANY-KEY', 'fiction-linter');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('ECONNREFUSED');
    });

    it('POSTs to the LemonSqueezy validate endpoint with correct body', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ valid: true, meta: {} }),
        });

        await licensing.validateLicenseKey('K', 'fl');

        const [url, opts] = global.fetch.mock.calls[0];
        expect(url).toBe('https://api.lemonsqueezy.com/v1/licenses/validate');
        expect(opts.method).toBe('POST');
        const body = JSON.parse(opts.body);
        expect(body.license_key).toBe('K');
        expect(typeof body.instance_name).toBe('string');
        expect(body.instance_name.length).toBeGreaterThan(0);
    });
});
