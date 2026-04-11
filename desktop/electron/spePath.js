const path = require('path');

/**
 * Resolve the default SPE rules directory.
 *
 * In dev mode, the project's `resources/spe_defaults/` sits next to
 * `desktop/` — `app.getAppPath()` returns the desktop directory, so
 * walking up one level + `resources/spe_defaults` is correct.
 *
 * In packaged mode, the resources are copied into the app bundle via
 * electron-builder's `extraResources` config. At runtime they live at
 * `process.resourcesPath/spe_defaults`. `app.getAppPath()` would point
 * inside `app.asar`, which is wrong.
 *
 * Accepts its dependencies as a parameter for testability.
 */
function getDefaultSpePath({ app, resourcesPath } = {}) {
    const _app = app || require('electron').app;
    const _resources = resourcesPath || process.resourcesPath;

    if (_app.isPackaged) {
        return path.join(_resources, 'spe_defaults');
    }
    return path.resolve(_app.getAppPath(), '..', 'resources', 'spe_defaults');
}

module.exports = { getDefaultSpePath };
