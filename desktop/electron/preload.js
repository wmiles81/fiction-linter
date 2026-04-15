const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    chooseFolder: () => ipcRenderer.invoke('dialog:chooseFolder'),
    listDirectory: dirPath => ipcRenderer.invoke('fs:listDirectory', dirPath),
    readFile: filePath => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath, contents) => ipcRenderer.invoke('fs:writeFile', { filePath, contents }),
    readDocx: filePath => ipcRenderer.invoke('fs:readDocx', filePath),
    readGdoc: filePath => ipcRenderer.invoke('fs:readGdoc', filePath),
    gdocAuth: () => ipcRenderer.invoke('gdoc:auth'),
    gdocSignout: () => ipcRenderer.invoke('gdoc:signout'),
    openExternal: url => ipcRenderer.invoke('shell:openExternal', url),
    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: settings => ipcRenderer.invoke('settings:set', settings),
    setLastRootPath: rootPath => ipcRenderer.invoke('settings:setLastRootPath', rootPath),
    loadSpeData: spePath => ipcRenderer.invoke('spe:load', spePath),
    aiComplete: payload => ipcRenderer.invoke('ai:complete', payload),
    aiScan: paragraph => ipcRenderer.invoke('ai:scan', { paragraph }),
    appendAnnotation: (sourcePath, entry) =>
        ipcRenderer.invoke('annotation:append', { sourcePath, entry }),
    writeFindings: (sourcePath, payload) =>
        ipcRenderer.invoke('findings:write', { sourcePath, payload }),
    fetchModels: config => ipcRenderer.invoke('models:fetch', config),
    loadTabs: () => ipcRenderer.invoke('tabs:load'),
    saveTabs: state => ipcRenderer.invoke('tabs:save', state),
    onMenuAction: (callback) => {
        const handler = (_event, payload) => callback(payload);
        ipcRenderer.on('menu:action', handler);
        return () => ipcRenderer.removeListener('menu:action', handler);
    }
});
