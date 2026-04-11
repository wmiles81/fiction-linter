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

// NOTE on .gdoc handling: an earlier attempt to import .gdoc files inline
// (via Electron's net.request with a persist:google-auth session partition,
// plus an interactive sign-in BrowserWindow) crashed Electron 31.7.7 on
// macOS 26.3.1 with a deterministic SIGSEGV inside the fontations glyph
// rendering code. The crash was reproducible across multiple code variations
// and the stack trace pointed at Electron's native font/text rendering, not
// any JS-callable API I was touching. The only stable path on this Electron
// version is to NOT call BrowserWindow / net.request from the gdoc flow at
// all — so .gdoc click reads the JSON pointer and hands the URL to the
// user's default browser via shell.openExternal. Inline gdoc import is
// deferred until either Electron is upgraded (32+ has fontations updates
// for newer macOS versions) or full Google Drive OAuth lands as a Phase 8
// feature (which doesn't go through net.request at all).

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

// Read a .gdoc pointer file and return the URL inside it. .gdoc files on
// disk are tiny JSON pointers to cloud documents — there's no content
// locally. The renderer hands the returned URL to shell.openExternal so the
// user opens the doc in their default browser.
//
// PREVIOUSLY: this handler tried to fetch the actual document content via
// Electron net.request + a persistent session partition + an interactive
// sign-in BrowserWindow. That crashed Electron 31.7.7 on macOS 26.3.1 with
// a deterministic SIGSEGV inside the native fontations glyph rendering
// code (see the comment block above the imports). The simple URL-only
// version below avoids the entire crash surface.
//
// FUTURE: inline gdoc import will land in Phase 8 once one of these is true:
//   1. Electron is upgraded to a version that doesn't crash on this macOS
//      (Electron 32+ has fontations updates for newer macOS releases).
//   2. Full Google Drive OAuth is implemented (which uses an OAuth client_id
//      and HTTPS API calls, not the BrowserWindow / net.request path that
//      crashes here).
ipcMain.handle('fs:readGdoc', async (_event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) {
        return { ok: false, error: 'File not found.' };
    }

    let docId = null;
    let docUrl = null;
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        // Try JSON first (the modern format Drive sync writes).
        try {
            const data = JSON.parse(raw);
            docId = data.doc_id || data.docId || null;
            docUrl = data.url || data.uri || null;
            if (!docId && docUrl) {
                const m = docUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
                if (m) docId = m[1];
            }
        } catch {
            // Not valid JSON — try scraping the first http(s) URL out of the file.
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

    if (!docUrl) {
        return { ok: false, error: 'No URL found in .gdoc pointer file.' };
    }

    return { ok: true, url: docUrl };
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
