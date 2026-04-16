const { Menu, app, BrowserWindow } = require('electron');

function sendToRenderer(channel, payload) {
    const wins = BrowserWindow.getAllWindows();
    for (const win of wins) {
        win.webContents.send(channel, payload);
    }
}

function buildMenuTemplate() {
    const isMac = process.platform === 'darwin';

    return [
        ...(isMac ? [{
            label: app.name,
            submenu: [
                {
                    label: 'About Fiction Linter',
                    click: () => sendToRenderer('menu:action', { action: 'show-about' })
                },
                { type: 'separator' },
                {
                    label: 'Settings…',
                    accelerator: 'Cmd+,',
                    click: () => sendToRenderer('menu:action', { action: 'open-settings' })
                },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] : []),
        {
            label: 'File',
            submenu: [
                {
                    label: 'New',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => sendToRenderer('menu:action', { action: 'new-file' })
                },
                {
                    label: 'Open Folder…',
                    accelerator: 'CmdOrCtrl+Shift+O',
                    click: () => sendToRenderer('menu:action', { action: 'open-folder' })
                },
                { type: 'separator' },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => sendToRenderer('menu:action', { action: 'save' })
                },
                {
                    label: 'Save As…',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => sendToRenderer('menu:action', { action: 'save-as' })
                },
                { type: 'separator' },
                {
                    label: 'Close Tab',
                    accelerator: 'CmdOrCtrl+W',
                    click: () => sendToRenderer('menu:action', { action: 'close-tab' })
                },
                ...(isMac ? [] : [
                    { type: 'separator' },
                    {
                        label: 'Settings',
                        accelerator: 'Ctrl+,',
                        click: () => sendToRenderer('menu:action', { action: 'open-settings' })
                    },
                    { type: 'separator' },
                    { role: 'quit' }
                ])
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
                { type: 'separator' },
                {
                    label: 'Find',
                    accelerator: 'CmdOrCtrl+F',
                    click: () => sendToRenderer('menu:action', { action: 'find' })
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle Linting',
                    accelerator: 'CmdOrCtrl+L',
                    click: () => sendToRenderer('menu:action', { action: 'toggle-lint' })
                },
                {
                    label: 'Toggle Findings Display',
                    accelerator: 'CmdOrCtrl+Shift+L',
                    click: () => sendToRenderer('menu:action', { action: 'toggle-findings' })
                },
                { type: 'separator' },
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Fiction Linter Help',
                    accelerator: 'F1',
                    click: () => sendToRenderer('menu:action', { action: 'open-help' })
                },
                {
                    label: 'Online Documentation',
                    click: () => {
                        const { shell } = require('electron');
                        shell.openExternal('https://ocotilloquillpress.com/docs/fiction-linter');
                    }
                },
                { type: 'separator' },
                {
                    label: 'About Fiction Linter',
                    click: () => sendToRenderer('menu:action', { action: 'show-about' })
                },
                {
                    label: 'Check for Updates...',
                    click: () => sendToRenderer('menu:action', { action: 'check-updates' })
                },
                {
                    label: 'Deactivate License...',
                    click: () => sendToRenderer('menu:action', { action: 'deactivate-license' })
                }
            ]
        }
    ];
}

function installMenu() {
    const menu = Menu.buildFromTemplate(buildMenuTemplate());
    Menu.setApplicationMenu(menu);
}

module.exports = { installMenu, buildMenuTemplate };
