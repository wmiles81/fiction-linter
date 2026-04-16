const { autoUpdater } = require('electron-updater');

function initAutoUpdater(mainWindow) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.logger = null;

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
