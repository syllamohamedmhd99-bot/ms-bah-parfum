import { contextBridge, ipcRenderer } from 'electron';

// Exposer une API sécurisée et strictement contrôlée au renderer frontend
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getUserDataPath: () => ipcRenderer.invoke('app:user-data-path'),
  selectBackupDirectory: () => ipcRenderer.invoke('dialog:select-backup-dir'),
  selectRestoreFile: () => ipcRenderer.invoke('dialog:select-restore-file'),
  selectExcelFile: () => ipcRenderer.invoke('dialog:select-excel-file'),
  performBackup: (targetDir?: string) => ipcRenderer.invoke('backup:perform', targetDir),
  performRestore: (sourcePath: string) => ipcRenderer.invoke('backup:restore', sourcePath),
  printReceipt: (htmlContent: string) => ipcRenderer.invoke('print:receipt', htmlContent),
  saveReceiptPDF: (htmlContent: string, defaultFileName: string) => ipcRenderer.invoke('save:receipt-pdf', { htmlContent, defaultFileName }),
  openPath: (filePath: string) => ipcRenderer.invoke('app:open-path', filePath),
  showInFolder: (filePath: string) => ipcRenderer.invoke('app:show-in-folder', filePath),
  openUserDataFolder: () => ipcRenderer.invoke('app:open-user-data'),
  restartApp: () => ipcRenderer.invoke('app:restart'),
  quitApp: () => ipcRenderer.invoke('app:quit')
});
