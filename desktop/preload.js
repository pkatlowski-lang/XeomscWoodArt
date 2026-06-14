'use strict';

// Minimalny, bezpieczny most. Edytor nie wymaga API Node, ale udostępniamy
// kilka informacji o aplikacji (np. do ewentualnego pokazania wersji w UI).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('xeoDesktop', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    app: process.env.npm_package_version || null,
    electron: process.versions.electron,
    chrome: process.versions.chrome
  },
  activate: (code) => ipcRenderer.invoke('license:activate', code)
});
