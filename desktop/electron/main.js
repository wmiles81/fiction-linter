const { app, BrowserWindow, ipcMain, dialog, shell, session, net } = require('electron');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const mammoth = require('mammoth');
const { callChatCompletion } = require('./aiClient');
const { fetchModels } = require('./modelCatalog');
const { buildExplainMessages, buildRewriteMessages } = require('./prompts');
const { getDefaultSpePath: resolveDefaultSpePath } = require('./spePath');
const { installMenu } = require('./menu');

// macOS 26.3.1 ships CoreText changes that crash Chromium's fontations (Rust)
// font backend with a null-pointer dereference (SIGSEGV at 0x17) whenever a
// BrowserWindow renders text. This forces Chromium to fall back to the previous
// CoreText/FreeType font rendering path, which handles the new APIs correctly.
// Must be called before app.whenReady().
app.commandLine.appendSwitch('disable-features', 'FontationsFontBackend');

// Persistent session partition for Google Docs authentication. Cookies stored
// here survive app restarts. Used by both the gdoc:fetch path (via net.request)
// AND the gdoc:auth interactive sign-in window (via webPreferences.partition).
// Approach borrowed from Focus-viewer-spec/09-google-docs.md — instead of
// registering a Google Cloud OAuth client, we BE the logged-in browser.
//
// HISTORY: an earlier attempt on Electron 31.7.7 + macOS 26.3.1 crashed the
// main process with a deterministic SIGSEGV inside the fontations glyph
// renderer when this BrowserWindow opened. Electron 32+ ships fontations
// updates for newer macOS releases, so this code now lives behind an
// Electron 34 baseline (see desktop/package.json).
const GOOGLE_AUTH_PARTITION = 'persist:google-auth';
const GOOGLE_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function getGoogleSession() {
    return session.fromPartition(GOOGLE_AUTH_PARTITION);
}

// Detect a Google login page in a response body. Google sometimes returns
// HTTP 200 with a login page when an unauthenticated request hits the export
// URL — content-type alone isn't enough.
function isGoogleLoginPage(body) {
    if (!body) return false;
    return body.includes('accounts.google.com') ||
           body.includes('ServiceLogin') ||
           body.includes('identifier-shown');
}

// Promise wrapper around Electron's net.request. Returns:
//   { ok: true, body, contentType, status }       on successful fetch
//   { ok: false, kind: 'auth-required', reason }  on 401/403/login page
//   { ok: false, error }                          on network/other failures
//
// Uses `partition: GOOGLE_AUTH_PARTITION` (a string) instead of
// `session: <Session>` (an object). Both are valid Electron APIs but the
// string variant has fewer lifecycle gotchas — passing a Session object
// can null-pointer-crash the main process when the object's lifetime gets
// tangled with the request lifecycle.
function fetchWithGoogleSession(url) {
    return new Promise((resolve) => {
        const request = net.request({
            method: 'GET',
            url,
            partition: GOOGLE_AUTH_PARTITION,
            useSessionCookies: true,
            redirect: 'follow'
        });
        request.setHeader('User-Agent', GOOGLE_USER_AGENT);

        const chunks = [];
        request.on('response', (response) => {
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                const status = response.statusCode || 0;
                let contentType = response.headers['content-type'] || '';
                if (Array.isArray(contentType)) contentType = contentType.join('; ');

                // 401 / 403 → auth required
                if (status === 401 || status === 403) {
                    return resolve({ ok: false, kind: 'auth-required', reason: `HTTP ${status}` });
                }
                // Login page in body → auth required
                if (isGoogleLoginPage(body)) {
                    return resolve({ ok: false, kind: 'auth-required', reason: 'Google login page returned' });
                }
                // 2xx with non-login body → success
                if (status >= 200 && status < 300) {
                    return resolve({ ok: true, body, contentType, status });
                }
                resolve({ ok: false, error: `HTTP ${status}` });
            });
            response.on('error', (err) => resolve({ ok: false, error: err.message }));
        });
        request.on('error', (err) => resolve({ ok: false, error: err.message }));

        // 30s safety timeout — Google export of large docs can take a few seconds.
        const timeoutId = setTimeout(() => {
            try { request.abort(); } catch { /* request may already be done */ }
            resolve({ ok: false, error: 'Request timed out after 30s' });
        }, 30000);
        request.on('response', () => clearTimeout(timeoutId));
        request.on('error', () => clearTimeout(timeoutId));

        request.end();
    });
}

const SETTINGS_FILE = 'settings.json';
const TABS_FILE = 'tabs.json';

function readTabs() {
    const tabsPath = path.join(app.getPath('userData'), TABS_FILE);
    if (!fs.existsSync(tabsPath)) return { tabs: [], activeTabId: null };
    try {
        return JSON.parse(fs.readFileSync(tabsPath, 'utf8'));
    } catch (error) {
        console.error('readTabs failed:', error);
        return { tabs: [], activeTabId: null };
    }
}

function writeTabs(state) {
    const tabsPath = path.join(app.getPath('userData'), TABS_FILE);
    const payload = {
        tabs: Array.isArray(state?.tabs) ? state.tabs : [],
        activeTabId: state?.activeTabId ?? null
    };
    fs.writeFileSync(tabsPath, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
}

function getDefaultSpePath() {
    return resolveDefaultSpePath();
}

function readSettings() {
    const settingsPath = path.join(app.getPath('userData'), SETTINGS_FILE);
    if (!fs.existsSync(settingsPath)) {
        return {
            spePath: getDefaultSpePath(),
            ai: {
                provider: 'openrouter',
                model: 'openai/gpt-4.1-mini',
                apiKey: '',
                baseUrl: '',
                hyperparameters: {}
            }
        };
    }

    try {
        const raw = fs.readFileSync(settingsPath, 'utf8');
        const data = JSON.parse(raw);
        return {
            spePath: data.spePath || getDefaultSpePath(),
            ai: {
                provider: data.ai?.provider || 'openrouter',
                model: data.ai?.model || 'openai/gpt-4.1-mini',
                apiKey: data.ai?.apiKey || '',
                baseUrl: data.ai?.baseUrl || '',
                hyperparameters: data.ai?.hyperparameters || {}
            }
        };
    } catch (error) {
        return {
            spePath: getDefaultSpePath(),
            ai: {
                provider: 'openrouter',
                model: 'openai/gpt-4.1-mini',
                apiKey: '',
                baseUrl: '',
                hyperparameters: {}
            }
        };
    }
}

function writeSettings(settings) {
    const settingsPath = path.join(app.getPath('userData'), SETTINGS_FILE);
    const payload = {
        spePath: settings.spePath || getDefaultSpePath(),
        ai: {
            provider: settings.ai?.provider || 'openrouter',
            model: settings.ai?.model || 'openai/gpt-4.1-mini',
            apiKey: settings.ai?.apiKey || '',
            baseUrl: settings.ai?.baseUrl || '',
            hyperparameters: settings.ai?.hyperparameters || {}
        }
    };
    fs.writeFileSync(settingsPath, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
}

function createWindow() {
    const window = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 980,
        minHeight: 640,
        backgroundColor: '#f5f2ee',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    const isDev = !app.isPackaged;
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;

    if (isDev && devServerUrl) {
        window.loadURL(devServerUrl);
        window.webContents.openDevTools({ mode: 'detach' });
    } else {
        window.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();
    installMenu();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.handle('dialog:chooseFolder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    return result.filePaths[0];
});

ipcMain.handle('fs:listDirectory', async (_event, dirPath) => {
    if (!dirPath || !fs.existsSync(dirPath)) {
        return [];
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const mapped = entries
        .filter(entry => !entry.name.startsWith('.'))
        .map(entry => ({
            name: entry.name,
            path: path.join(dirPath, entry.name),
            isDirectory: entry.isDirectory()
        }))
        .sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });

    return mapped;
});

ipcMain.handle('fs:readFile', async (_event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) {
        return { ok: false, error: 'File not found.' };
    }

    try {
        const contents = fs.readFileSync(filePath, 'utf8');
        return { ok: true, contents };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('fs:writeFile', async (_event, payload) => {
    if (!payload?.filePath) {
        return { ok: false, error: 'Missing file path.' };
    }

    try {
        fs.writeFileSync(payload.filePath, payload.contents ?? '', 'utf8');
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

// Read a .docx file as binary, run mammoth to convert to HTML. The renderer
// then converts that HTML to markdown via the existing editor/converters.js
// `htmlToMarkdown` (the same pipeline as paste handling), so .docx import
// uses the same code path as gdoc paste — consistent results.
//
// Returns { ok, html, messages } on success or { ok: false, error } on failure.
// `messages` is mammoth's array of conversion warnings (e.g., unsupported
// styles); we surface them so the renderer can show a status note if any.
ipcMain.handle('fs:readDocx', async (_event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) {
        return { ok: false, error: 'File not found.' };
    }
    try {
        const buffer = fs.readFileSync(filePath);
        const result = await mammoth.convertToHtml({ buffer });
        return {
            ok: true,
            html: result.value || '',
            messages: (result.messages || []).map(m => ({ type: m.type, message: m.message }))
        };
    } catch (error) {
        return { ok: false, error: `mammoth conversion failed: ${error.message}` };
    }
});

// Read a .gdoc pointer file and fetch the actual document content from
// Google. .gdoc files on disk are tiny JSON pointers to cloud documents —
// no content locally.
//
// Strategy (per Focus-viewer-spec/09-google-docs.md):
//   1. Parse the file: try JSON first, fall back to URL extraction from text.
//   2. Extract the doc_id (from json field or by regex on the URL).
//   3. Fetch https://docs.google.com/document/d/{id}/export?format=html
//      using Electron's net.request with a persistent session partition
//      (persist:google-auth). Cookies from a prior interactive sign-in
//      automatically attach.
//   4. If the response is HTML and is NOT a Google login page → return
//      { kind: 'imported', html, baseName, sourceUrl }. The renderer pipes
//      the HTML through htmlToMarkdown (the same converter used for paste,
//      including the styledSpansToSemanticPlugin that handles Google Docs
//      styled spans) and opens as an editor tab.
//   5. If the response is a login page or 401/403 → return
//      { kind: 'auth-required', url }. The renderer prompts the user to
//      sign in via gdoc:auth, which opens an interactive sign-in window
//      sharing the same session partition. After successful sign-in, the
//      renderer retries fs:readGdoc once.
ipcMain.handle('fs:readGdoc', async (_event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) {
        return { ok: false, error: 'File not found.' };
    }

    // Parse the .gdoc pointer file. Two strategies: JSON (the modern format),
    // falling back to "scrape any URL out of the text" for older variants.
    let docId = null;
    let docUrl = null;
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        try {
            const data = JSON.parse(raw);
            docId = data.doc_id || data.docId || null;
            docUrl = data.url || data.uri || null;
            if (!docId && docUrl) {
                const m = docUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
                if (m) docId = m[1];
            }
        } catch {
            // Not valid JSON — try plain URL extraction.
            const urlMatch = raw.match(/https?:\/\/[^\s"]+/);
            if (urlMatch) {
                docUrl = urlMatch[0];
                const idMatch = docUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
                if (idMatch) docId = idMatch[1];
            }
        }
        if (!docUrl && docId) {
            docUrl = `https://docs.google.com/document/d/${docId}/edit`;
        }
    } catch (error) {
        return { ok: false, error: `gdoc parse failed: ${error.message}` };
    }

    if (!docId) {
        return { ok: false, error: 'No doc_id found in .gdoc pointer file.' };
    }

    // Fetch the HTML export via Electron net.request with the persistent
    // Google auth session. If the user has signed in (via gdoc:auth) then
    // the cookies in persist:google-auth will authenticate this request.
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=html`;
    const result = await fetchWithGoogleSession(exportUrl);

    if (result.ok) {
        const baseName = path.basename(filePath, path.extname(filePath));
        return {
            ok: true,
            kind: 'imported',
            html: result.body || '',
            baseName,
            sourceUrl: docUrl
        };
    }

    if (result.kind === 'auth-required') {
        return { ok: true, kind: 'auth-required', url: docUrl, reason: result.reason };
    }

    return { ok: false, error: result.error || 'gdoc fetch failed' };
});

// Open an interactive Google sign-in window. Uses the persist:google-auth
// partition that fs:readGdoc fetches with — so cookies set during sign-in
// are automatically used by subsequent fetches. No OAuth client_id or
// Google Cloud project required: we drive Google's normal browser-based
// sign-in flow inside an embedded BrowserWindow.
//
// Resolves with { ok: true } when sign-in completes (detected by navigation
// to docs.google.com), or { ok: false, error } if the user closes the window
// or any step fails. Wrapped in try/catch so a BrowserWindow construction
// failure cannot crash the main process — returns an error instead.
ipcMain.handle('gdoc:auth', async () => {
    return new Promise((resolve) => {
        let authWindow = null;
        let resolved = false;

        const safeClose = () => {
            if (!authWindow) return;
            try {
                if (!authWindow.isDestroyed()) {
                    authWindow.close();
                }
            } catch {
                // Window already gone — ignore.
            }
        };

        const finish = (result) => {
            if (resolved) return;
            resolved = true;
            // Close the window if it's still alive. Do NOT call close() from
            // inside the 'closed' event handler — the native object is in
            // teardown and isDestroyed() may briefly lie.
            if (result && result.ok) safeClose();
            resolve(result);
        };

        try {
            authWindow = new BrowserWindow({
                width: 500,
                height: 700,
                title: 'Sign in to Google',
                show: true,
                webPreferences: {
                    // Use the partition STRING, not a Session object. The string
                    // form is the documented and well-tested API; passing a
                    // Session object has caused null-pointer crashes in the
                    // main process under sandbox + custom-session combinations.
                    partition: GOOGLE_AUTH_PARTITION,
                    contextIsolation: true,
                    nodeIntegration: false,
                    sandbox: true
                }
            });
        } catch (err) {
            finish({ ok: false, error: `Failed to open sign-in window: ${err.message}` });
            return;
        }

        try {
            authWindow.webContents.setUserAgent(GOOGLE_USER_AGENT);
        } catch {
            // Non-fatal; default Electron UA still works for Google.
        }

        // Watch for navigation to docs.google.com — that's our signal that
        // sign-in completed (Google's `continue=` parameter brings us there).
        // Each handler defensively checks isDestroyed because navigation
        // events can fire concurrently with window teardown.
        const handleNav = (_event, url) => {
            if (resolved || !authWindow || authWindow.isDestroyed()) return;
            if (url && url.startsWith('https://docs.google.com')) {
                finish({ ok: true });
            }
        };

        try {
            authWindow.webContents.on('did-navigate', handleNav);
            authWindow.webContents.on('did-redirect-navigation', handleNav);
            authWindow.webContents.on('did-navigate-in-page', handleNav);
        } catch (err) {
            finish({ ok: false, error: `Failed to attach navigation listeners: ${err.message}` });
            return;
        }

        // The 'closed' event fires when the user closes the window OR after
        // we close it ourselves via finish({ok:true}). Only treat it as a
        // user cancellation if we have not already resolved.
        authWindow.on('closed', () => {
            if (!resolved) {
                resolved = true;
                resolve({ ok: false, error: 'Sign-in window was closed before authentication completed.' });
            }
        });

        try {
            authWindow.loadURL('https://accounts.google.com/ServiceLogin?continue=https://docs.google.com');
        } catch (err) {
            finish({ ok: false, error: `Failed to load sign-in URL: ${err.message}` });
        }
    });
});

// Sign out of Google: clear all storage data for the persist:google-auth
// partition (cookies, cache, local storage, etc.). After this the next
// fs:readGdoc on a private doc will return auth-required again.
ipcMain.handle('gdoc:signout', async () => {
    try {
        await getGoogleSession().clearStorageData();
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

// Open a URL in the user's default browser via Electron's shell module.
// Used to hand off .gdoc URLs to Chrome/Safari/etc.
ipcMain.handle('shell:openExternal', async (_event, url) => {
    if (!url || typeof url !== 'string') {
        return { ok: false, error: 'Missing or invalid URL.' };
    }
    // Defense in depth: only allow http(s) and mailto schemes. Refuses
    // file://, javascript:, data: and other potentially dangerous schemes.
    if (!/^(https?:|mailto:)/i.test(url)) {
        return { ok: false, error: 'Refused: only http, https, and mailto URLs are allowed.' };
    }
    try {
        await shell.openExternal(url);
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('settings:get', async () => {
    return readSettings();
});

ipcMain.handle('settings:set', async (_event, settings) => {
    return writeSettings(settings || {});
});

ipcMain.handle('models:fetch', async (_event, providerConfig) => {
    return fetchModels(providerConfig || {});
});

ipcMain.handle('tabs:load', async () => readTabs());

ipcMain.handle('tabs:save', async (_event, state) => writeTabs(state || {}));

const SPE_FILES = [
    { key: 'cliches', name: 'cliche_collider.yaml' },
    { key: 'names', name: 'name_collider.yaml' },
    { key: 'places', name: 'place_collider.yaml' },
    { key: 'protocols', name: 'line_editing_protocol.yaml' }
];

ipcMain.handle('spe:load', async (_event, spePath) => {
    const empty = { cliches: {}, names: {}, places: {}, protocols: {} };
    if (!spePath || !fs.existsSync(spePath)) {
        return empty;
    }

    const result = { ...empty };
    for (const file of SPE_FILES) {
        const filePath = path.join(spePath, file.name);
        if (!fs.existsSync(filePath)) continue;
        try {
            const contents = fs.readFileSync(filePath, 'utf8');
            result[file.key] = yaml.load(contents) || {};
        } catch (error) {
            // Preserve empty default for this key; log to main console.
            console.error(`spe:load failed for ${file.name}:`, error);
            result[file.key] = {};
        }
    }
    return result;
});

ipcMain.handle('ai:complete', async (_event, payload) => {
    const { kind, finding, snippet } = payload || {};
    if (kind !== 'explain' && kind !== 'rewrite') {
        return { ok: false, error: `Unknown kind: ${kind}` };
    }
    if (!finding || !snippet) {
        return { ok: false, error: 'Missing finding or snippet.' };
    }

    // Read settings from disk — do NOT trust payload. Keeps the key
    // out of renderer-supplied data entirely.
    const settings = readSettings();
    const messages = kind === 'explain'
        ? buildExplainMessages({ finding, snippet })
        : buildRewriteMessages({ finding, snippet });

    return callChatCompletion({
        baseUrl: settings.ai.baseUrl,
        apiKey: settings.ai.apiKey,
        model: settings.ai.model,
        hyperparameters: settings.ai.hyperparameters,
        messages
    });
});
