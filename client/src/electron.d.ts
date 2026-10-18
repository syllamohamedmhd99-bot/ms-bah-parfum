export interface ElectronAPI {
  isElectron: boolean;
  getAppVersion: () => Promise<string>;
  getUserDataPath: () => Promise<string>;
  selectBackupDirectory: () => Promise<string | null>;
  selectRestoreFile: () => Promise<string | null>;
  selectExcelFile: () => Promise<string | null>;
  performBackup: (targetDir?: string) => Promise<any>;
  performRestore: (sourcePath: string) => Promise<any>;
  printReceipt: (htmlContent: string) => Promise<{ success: boolean; failureReason?: string }>;
  saveReceiptPDF: (htmlContent: string, defaultFileName: string) => Promise<{
    success: boolean;
    canceled?: boolean;
    filePath?: string;
    fileName?: string;
    error?: string;
  }>;
  openPath: (filePath: string) => Promise<boolean>;
  showInFolder: (filePath: string) => Promise<boolean>;
  openUserDataFolder: () => Promise<void>;
  restartApp: () => Promise<void>;
  quitApp: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
