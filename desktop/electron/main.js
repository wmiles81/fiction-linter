const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const { callChatCompletion } = require('./aiClient');
const { buildExplainMessages, buildRewriteMessages } = require('./prompts');
const { getDefaultSpePath: resolveDefaultSpePath } = require('./spePath');

const SETTINGS_FILE = 'settings.json';

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
                baseUrl: ''
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
                baseUrl: data.ai?.baseUrl || ''
            }
        };
    } catch (error) {
        return {
            spePath: getDefaultSpePath(),
            ai: {
                provider: 'openrouter',
                model: 'openai/gpt-4.1-mini',
                apiKey: '',
                baseUrl: ''
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
            baseUrl: settings.ai?.baseUrl || ''
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

ipcMain.handle('settings:get', async () => {
    return readSettings();
});

ipcMain.handle('settings:set', async (_event, settings) => {
    return writeSettings(settings || {});
});

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
        messages
    });
});
