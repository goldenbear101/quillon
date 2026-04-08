// preload.js — exposes safe APIs to the renderer
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',
  isElectron: true
})
