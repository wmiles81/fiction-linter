const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const mammoth = require('mammoth');
const { callChatCompletion } = require('./aiClient');
const { fetchModels } = require('./modelCatalog');
const { buildExplainMessages, buildRewriteMessages } = require('./prompts');
const { getDefaultSpePath: resolveDefaultSpePath } = require('./spePath');
const { installMenu } = require('./menu');

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

// Read a .gdoc pointer file and (best effort) fetch the actual document
// content via Google's unauthenticated export URL. .gdoc files on disk are
// tiny JSON pointers to cloud documents — there's no content locally.
//
// Strategy:
//   1. Parse the JSON, extract doc_id (or scrape from a URL field).
//   2. Try GET https://docs.google.com/document/d/{id}/export?format=docx
//   3. If the response is application/vnd.openxmlformats... (real docx
//      binary), run mammoth on it and return { kind: 'imported', html, ... }.
//      The renderer handles this exactly like a local .docx import.
//   4. If the response Content-Type is text/html, the fetch was redirected
//      to a Google login page — the doc is private and we can't read it
//      without OAuth. Return { kind: 'auth-required', url: <doc-url> } so
//      the renderer can fall back to opening in the user's browser.
//
// Future Phase 8: full Google Drive OAuth would let private docs open
// inline too, but that's a registered Google Cloud project + client_id +
// refresh token storage, which is well outside the scope of "make .gdoc
// open here when possible."
ipcMain.handle('fs:readGdoc', async (_event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) {
        return { ok: false, error: 'File not found.' };
    }

    // 1. Parse the JSON pointer.
    let docId = null;
    let docUrl = null;
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        // Different macOS / Drive versions have written this with different keys.
        docId = data.doc_id || data.docId || null;
        docUrl = data.url || data.uri || null;
        // If we got a URL but no doc_id, try to extract the id from the URL.
        if (!docId && docUrl) {
            const m = docUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
            if (m) docId = m[1];
        }
        // If we got a doc_id but no URL, build the canonical edit URL.
        if (!docUrl && docId) {
            docUrl = `https://docs.google.com/document/d/${docId}/edit`;
        }
    } catch (error) {
        return { ok: false, error: `gdoc parse failed: ${error.message}` };
    }

    if (!docId) {
        return { ok: false, error: 'No doc_id found in .gdoc pointer file.' };
    }

    // 2. Attempt the unauthenticated docx export.
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=docx`;
    let response;
    try {
        response = await fetch(exportUrl, {
            method: 'GET',
            redirect: 'follow',
            // 30s timeout — large docs take a few seconds to export server-side.
            signal: AbortSignal.timeout(30000)
        });
    } catch (error) {
        // Network failure — fall back to browser handoff so the user can at
        // least open the doc somewhere.
        return { ok: true, kind: 'auth-required', url: docUrl, reason: `Network error: ${error.message}` };
    }

    // 3. Inspect the response.
    const contentType = response.headers.get('content-type') || '';
    const isDocx = contentType.includes('officedocument.wordprocessingml.document')
        || contentType.includes('application/vnd.openxmlformats');

    if (response.ok && isDocx) {
        try {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const result = await mammoth.convertToHtml({ buffer });
            // Best-effort name: use the .gdoc filename minus extension.
            const baseName = path.basename(filePath, path.extname(filePath));
            return {
                ok: true,
                kind: 'imported',
                html: result.value || '',
                messages: (result.messages || []).map(m => ({ type: m.type, message: m.message })),
                baseName,
                sourceUrl: docUrl
            };
        } catch (error) {
            return { ok: false, error: `mammoth conversion failed: ${error.message}` };
        }
    }

    // 4. Anything else (text/html login redirect, 401, 403, 404, etc.) —
    //    we cannot fetch the content unauthenticated. Hand the URL back so
    //    the renderer can fall back to opening it in the browser.
    return {
        ok: true,
        kind: 'auth-required',
        url: docUrl,
        reason: `Document is private or requires authentication (HTTP ${response.status}, ${contentType || 'no content-type'})`
    };
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
