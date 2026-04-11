const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    chooseFolder: () => ipcRenderer.invoke('dialog:chooseFolder'),
    listDirectory: dirPath => ipcRenderer.invoke('fs:listDirectory', dirPath),
    readFile: filePath => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath, contents) => ipcRenderer.invoke('fs:writeFile', { filePath, contents }),
    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: settings => ipcRenderer.invoke('settings:set', settings),
    loadSpeData: spePath => ipcRenderer.invoke('spe:load', spePath)
});
