const { app, BrowserWindow, ipcMain, dialog, shell, session, net } = require('electron');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const mammoth = require('mammoth');
const { callChatCompletion } = require('./aiClient');
const { fetchModels } = require('./modelCatalog');
const { buildExplainMessages, buildRewriteMessages, buildScanMessages } = require('./prompts');
const { getDefaultSpePath: resolveDefaultSpePath } = require('./spePath');
const { installMenu } = require('./menu');
const { readStoredLicense, storeLicense, clearLicense, shouldRevalidate, validateLicenseKey } = require('./licensing');

let mainWindow = null;

// Google Docs authentication uses Electron's default session (the same one
// the main window uses). Earlier attempts with a custom partition
// (persist:google-auth) crashed on macOS 26.3.1 with a deterministic SIGSEGV
// in fontations (Chromium's Rust font renderer) during partition init.
// The default session renders fine in the main window — sharing it for the
// auth BrowserWindow avoids the crash entirely.
//
// Cookies from Google sign-in persist in the default session across app
// restarts (Electron persists the default session by default). The
// gdoc:signout handler clears Google cookies specifically.
const GOOGLE_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

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
// Uses the default session (no partition specified). This means cookies set
// during the gdoc:auth sign-in flow (which also uses the default session)
// will automatically attach to this request.
function fetchWithGoogleSession(url) {
    return new Promise((resolve) => {
        const request = net.request({
            method: 'GET',
            url,
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
            lastRootPath: data.lastRootPath || '',
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
            lastRootPath: '',
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

// Resolve the effective base URL for a chat-completion call.
// Users who picked OpenRouter/OpenAI/etc. and left baseUrl blank should get
// the provider's default endpoint rather than a hard "missing baseUrl" error.
// Kept aligned with fetchOpenRouterModels / fetchOpenAIModels / fetchAnthropicModels
// / fetchOllamaModels defaults in modelCatalog.js.
const PROVIDER_DEFAULT_BASE_URLS = {
    openrouter: 'https://openrouter.ai/api/v1',
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    ollama: 'http://localhost:11434'
};
function effectiveBaseUrl(aiSettings) {
    if (aiSettings?.baseUrl) return aiSettings.baseUrl;
    return PROVIDER_DEFAULT_BASE_URLS[aiSettings?.provider] || '';
}

function writeSettings(settings) {
    const settingsPath = path.join(app.getPath('userData'), SETTINGS_FILE);
    // Preserve lastRootPath across writes: the Settings dialog only knows
    // about spePath/ai, but we do not want those saves to clobber the
    // recently-opened folder. Read the current value first.
    const current = readSettings();
    const payload = {
        spePath: settings.spePath || getDefaultSpePath(),
        lastRootPath: settings.lastRootPath !== undefined
            ? settings.lastRootPath
            : current.lastRootPath,
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

// Persist just the lastRootPath without touching other settings. Called
// when the user opens a folder — localStorage handles this too, but the
// settings.json copy is a belt-and-suspenders fallback that survives
// storage-partition resets and cross-session quirks.
function writeLastRootPath(rootPath) {
    const settingsPath = path.join(app.getPath('userData'), SETTINGS_FILE);
    const current = readSettings();
    current.lastRootPath = rootPath || '';
    fs.writeFileSync(settingsPath, JSON.stringify(current, null, 2), 'utf8');
    return current;
}

function createWindow() {
    mainWindow = new BrowserWindow({
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
        mainWindow.loadURL(devServerUrl);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();
    installMenu();

    const { initAutoUpdater } = require('./updater');
    if (app.isPackaged) {
        initAutoUpdater(mainWindow);
    }

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

// Derive the sibling annotation file path from a source document path.
// `/foo/chapter1.md` → `/foo/chapter1.md.annotation.md`
// We include the double extension deliberately: ".annotation" signals intent,
// ".md" keeps it editor-friendly so the user can hand original + annotation
// to an AI for further work without any format conversion.
function annotationPathFor(sourcePath) {
    if (!sourcePath) return null;
    return `${sourcePath}.annotation.md`;
}

// Format a single annotation entry as markdown. Kept structured so future
// tooling (or another AI) can parse it, but still human-readable.
function formatAnnotationEntry({ line, category, severity, original, note, source }) {
    const header = ['##', `L${line}`];
    if (category) header.push(`— ${category}`);
    if (severity) header.push(`(${severity})`);
    const parts = [
        header.join(' '),
        '',
        '**Original:**',
        '> ' + (original || '').split('\n').join('\n> '),
        '',
        '**Note:**',
        note || '',
    ];
    if (source) {
        parts.push('', `_source: ${source}_`);
    }
    parts.push('', '---', '');
    return parts.join('\n');
}

// Append an annotation to the sibling file for the given source document.
// Creates the file with a header if it does not yet exist.
ipcMain.handle('annotation:append', async (_event, payload) => {
    const { sourcePath, entry } = payload || {};
    if (!sourcePath || typeof sourcePath !== 'string') {
        return { ok: false, error: 'Missing sourcePath.' };
    }
    if (!entry || typeof entry !== 'object') {
        return { ok: false, error: 'Missing entry payload.' };
    }
    const annotationPath = annotationPathFor(sourcePath);
    try {
        let contents = '';
        if (fs.existsSync(annotationPath)) {
            contents = fs.readFileSync(annotationPath, 'utf8');
        } else {
            const sourceName = path.basename(sourcePath);
            contents = [
                `# Annotations for ${sourceName}`,
                '',
                '<!-- Maintained by Fiction Linter. Each section below is one annotation. -->',
                '',
                '---',
                '',
                ''
            ].join('\n');
        }
        contents += formatAnnotationEntry(entry);
        fs.writeFileSync(annotationPath, contents, 'utf8');
        return { ok: true, annotationPath };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

// Write the findings snapshot alongside the source document as
// `<path>.findings.json`. Always OVERWRITES — each save produces a fresh
// deterministic snapshot of the current in-memory findings, aligned with
// the just-saved document state. The renderer computes the payload (word
// bounds, ordering, counts) via findingsFile.js; main just serializes
// and writes. Pretty-printed with 2-space indent so git diffs are useful.
ipcMain.handle('findings:write', async (_event, requestPayload) => {
    const { sourcePath, payload } = requestPayload || {};
    if (!sourcePath || typeof sourcePath !== 'string') {
        return { ok: false, error: 'Missing sourcePath.' };
    }
    if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Missing findings payload.' };
    }
    const findingsPath = `${sourcePath}.findings.json`;
    try {
        fs.writeFileSync(findingsPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
        return { ok: true, findingsPath };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

// Read the findings sidecar for a document. Returns the parsed JSON
// payload so the renderer can restore AI findings on tab switch / app
// restart instead of forcing the user to re-run the scan.
ipcMain.handle('findings:read', async (_event, sourcePath) => {
    if (!sourcePath || typeof sourcePath !== 'string') {
        return { ok: false, error: 'Missing sourcePath.' };
    }
    const findingsPath = `${sourcePath}.findings.json`;
    if (!fs.existsSync(findingsPath)) {
        return { ok: false, error: 'No findings file.' };
    }
    try {
        const raw = fs.readFileSync(findingsPath, 'utf8');
        const payload = JSON.parse(raw);
        return { ok: true, payload };
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
                    // Uses the default session (no partition). Earlier attempts
                    // with partition: 'persist:google-auth' crashed on macOS
                    // 26.3.1 during partition font-cache initialization.
                    // The default session is already proven stable (the main
                    // window uses it). Cookies persist across restarts.
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

        // Watch for the post-sign-in redirect to docs.google.com and CANCEL
        // the navigation before Chromium loads the destination. Rendering
        // docs.google.com triggers a fontations null-deref on macOS 26.3.1 —
        // by preventDefault()ing the redirect we keep the session cookies
        // (already set at this point) but never load the page that crashes.
        //
        // will-redirect fires when the server responds with a 3xx; calling
        // event.preventDefault() aborts the redirect entirely. The subsequent
        // finish({ok:true}) closes the window cleanly.
        //
        // will-navigate is the belt-and-suspenders fallback: if sign-in
        // completes via a direct navigation (no 3xx), this catches it too.
        const handleBeforeNav = (event, url) => {
            if (resolved || !authWindow || authWindow.isDestroyed()) return;
            if (url && url.startsWith('https://docs.google.com')) {
                try { event.preventDefault(); } catch { /* already too late */ }
                finish({ ok: true });
            }
        };

        try {
            authWindow.webContents.on('will-redirect', handleBeforeNav);
            authWindow.webContents.on('will-navigate', handleBeforeNav);
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

// Sign out of Google: remove Google cookies from the default session.
// Uses origin filter to only clear google.com cookies — preserves any
// other cookies the app may have set (none currently, but defensive).
ipcMain.handle('gdoc:signout', async () => {
    try {
        const defaultSession = session.defaultSession;
        await defaultSession.clearStorageData({
            origin: 'https://accounts.google.com'
        });
        await defaultSession.clearStorageData({
            origin: 'https://docs.google.com'
        });
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

ipcMain.handle('settings:setLastRootPath', async (_event, rootPath) => {
    return writeLastRootPath(rootPath || '');
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
    const { kind, finding, snippet, flagged } = payload || {};
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
        : buildRewriteMessages({ finding, snippet, flagged });

    return callChatCompletion({
        baseUrl: effectiveBaseUrl(settings.ai),
        apiKey: settings.ai.apiKey,
        model: settings.ai.model,
        hyperparameters: settings.ai.hyperparameters,
        messages
    });
});

// Per-paragraph AI scan. Renderer splits the document into paragraphs and
// fires one of these per paragraph (serially or throttled) so progress is
// observable and cancellation is granular. Returns raw AI text content —
// parsing the JSON is a renderer responsibility since it needs to handle
// malformed output gracefully without blowing up the main process.
ipcMain.handle('ai:scan', async (_event, payload) => {
    const { paragraph } = payload || {};
    if (!paragraph || typeof paragraph !== 'string') {
        return { ok: false, error: 'Missing paragraph text.' };
    }
    const settings = readSettings();
    const messages = buildScanMessages({ paragraph });
    return callChatCompletion({
        baseUrl: effectiveBaseUrl(settings.ai),
        apiKey: settings.ai.apiKey,
        model: settings.ai.model,
        hyperparameters: settings.ai.hyperparameters,
        messages
    });
});

ipcMain.handle('update:install', async () => {
    const { installUpdate } = require('./updater');
    installUpdate();
});
