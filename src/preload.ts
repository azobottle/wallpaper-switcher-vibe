import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  downloadNow: () => ipcRenderer.invoke('download-now'),
  getHistory: () => ipcRenderer.invoke('get-history'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (config: any) => ipcRenderer.invoke('update-config', config),
  onDownloadComplete: (callback: () => void) => {
    ipcRenderer.on('download-complete', callback);
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
