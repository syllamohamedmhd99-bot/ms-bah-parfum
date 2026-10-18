import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';

// Ensure single instance lock on Windows 11
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;
let serverInstance: http.Server | null = null;
let localServerPort = 5050;

// Setup persistent SQLite path in app.getPath('userData')
const userDataPath = app.getPath('userData');
const dbDir = path.join(userDataPath, 'data');
const backupsDir = path.join(userDataPath, 'backups');

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

const targetDbPath = path.join(userDataPath, 'boutique.db');
process.env.DB_PATH = targetDbPath;
process.env.NODE_ENV = app.isPackaged ? 'production' : 'development';

console.log(`[ELECTRON MAIN] Emplacement base SQLite: ${targetDbPath}`);

process.on('uncaughtException', (error) => {
  console.error('[ELECTRON MAIN] Exception non interceptée:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[ELECTRON MAIN] Rejet non intercepté:', reason);
});

async function startLocalServer(): Promise<number> {
  try {
    const serverModulePath = app.isPackaged
      ? path.join(__dirname, '../server/dist/server.js')
      : path.join(__dirname, '../server/dist/server.js');

    console.log(`[ELECTRON MAIN] Démarrage du serveur local depuis: ${serverModulePath}`);

    if (fs.existsSync(serverModulePath)) {
      const serverModule = require(serverModulePath);
      if (typeof serverModule.startServer === 'function') {
        const { server, port } = await serverModule.startServer(5050);
        serverInstance = server;
        localServerPort = port;
        return port;
      } else if (serverModule.default && typeof serverModule.default.startServer === 'function') {
        const { server, port } = await serverModule.default.startServer(5050);
        serverInstance = server;
        localServerPort = port;
        return port;
      }
    }
    console.warn('[ELECTRON MAIN] server.js introuvable ou startServer non exporté. Utilisation du port 5050.');
    return 5050;
  } catch (err) {
    console.error('[ELECTRON MAIN] Erreur démarrage serveur local:', err);
    return 5050;
  }
}

function createWindow(port: number) {
  const isDev = !app.isPackaged && process.env.VITE_DEV === '1';

  const iconPath = path.join(__dirname, '../build/icon.ico');
  const fallbackIconPath = path.join(__dirname, '../build/icon.png');
  const windowIcon = fs.existsSync(iconPath) ? iconPath : (fs.existsSync(fallbackIconPath) ? fallbackIconPath : undefined);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'MS BAH PARFUM — Gestion Commerciale & Point de Vente (Hors Ligne)',
    backgroundColor: '#F4F6F3',
    icon: windowIcon,
    show: false, // Don't show until ready-to-show to prevent white flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for preload IPC bridge
      webSecurity: true,
    },
  });

  // Windows 11 Fluent Menu
  const template: any[] = [
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Emplacement des données...',
          click: () => shell.openPath(userDataPath),
        },
        {
          label: 'Sauvegarder la base de données...',
          click: async () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:trigger-backup');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Quitter',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        { label: 'Recharger', accelerator: 'Ctrl+R', click: () => mainWindow?.reload() },
        { label: 'Plein écran', accelerator: 'F11', click: () => mainWindow?.setFullScreen(!mainWindow?.isFullScreen()) },
        { type: 'separator' },
        { label: 'Zoom avant', accelerator: 'Ctrl+Plus', role: 'zoomIn' },
        { label: 'Zoom arrière', accelerator: 'Ctrl+-', role: 'zoomOut' },
        { label: 'Réinitialiser le zoom', accelerator: 'Ctrl+0', role: 'resetZoom' },
      ],
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'À propos de MS BAH PARFUM',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'MS BAH PARFUM',
              message: 'MS BAH PARFUM v1.0.0 (Windows 11)',
              detail: `Gestion commerciale, parfumerie, cosmétique et articles divers.\nContact principal : 626 96 39 82 / +224 626 96 39 82\nMode 100% Hors Ligne.\nBase de données : SQLite WAL.\nRépertoire : ${userDataPath}`,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Load URL
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${port}`);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register IPC handlers
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:user-data-path', () => userDataPath);
ipcMain.handle('app:open-user-data', () => shell.openPath(userDataPath));

ipcMain.handle('dialog:select-backup-dir', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Sélectionner le dossier de sauvegarde (Clé USB ou Disque)',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('dialog:select-restore-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Sélectionner le fichier de sauvegarde à restaurer',
    properties: ['openFile'],
    filters: [
      { name: 'Sauvegarde SQLite', extensions: ['db', 'sqlite', 'bak'] },
      { name: 'Tous les fichiers', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('dialog:select-excel-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Sélectionner le fichier Excel de catalogue (.xlsx, .xls)',
    properties: ['openFile'],
    filters: [
      { name: 'Classeurs Excel (*.xlsx, *.xls)', extensions: ['xlsx', 'xls'] },
      { name: 'Tous les fichiers (*.*)', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('print:receipt', async (event, htmlContent: string) => {
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

  return new Promise((resolve) => {
    printWin.webContents.print(
      {
        silent: false,
        printBackground: true,
        pageSize: { width: 80000, height: 200000 }, // Standard 80mm thermal receipt
      },
      (success, failureReason) => {
        printWin.close();
        resolve({ success, failureReason });
      }
    );
  });
});

ipcMain.handle('save:receipt-pdf', async (event, { htmlContent, defaultFileName }: { htmlContent: string; defaultFileName?: string }) => {
  try {
    if (!mainWindow) return { success: false, error: 'Fenêtre principale introuvable' };

    const cleanFileName = (defaultFileName || 'Ticket-Vente.pdf').replace(/[\/\\?%*:|"<>]/g, '_');

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Enregistrer le ticket de caisse en format PDF',
      defaultPath: path.join(app.getPath('documents'), cleanFileName.endsWith('.pdf') ? cleanFileName : `${cleanFileName}.pdf`),
      filters: [
        { name: 'Document PDF (*.pdf)', extensions: ['pdf'] },
        { name: 'Tous les fichiers (*.*)', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    const printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    // Ensure all styles and DOM elements are rendered
    await new Promise((resolve) => setTimeout(resolve, 300));

    const pdfBuffer = await printWin.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
    });

    printWin.close();

    fs.writeFileSync(result.filePath, pdfBuffer);

    return {
      success: true,
      filePath: result.filePath,
      fileName: path.basename(result.filePath)
    };
  } catch (err: any) {
    console.error('[ELECTRON MAIN] Erreur enregistrement PDF:', err);
    return { success: false, error: err.message || 'Erreur lors de la génération du PDF' };
  }
});

ipcMain.handle('app:open-path', async (event, filePath: string) => {
  if (filePath && fs.existsSync(filePath)) {
    await shell.openPath(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('app:show-in-folder', async (event, filePath: string) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('app:restart', () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('app:quit', () => {
  app.quit();
});

// App lifecycle
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  const port = await startLocalServer();
  createWindow(port);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(port);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  try {
    if (serverInstance) {
      serverInstance.close();
      console.log('[ELECTRON MAIN] Serveur HTTP local fermé.');
    }
    // Attempt graceful WAL checkpoint before closing
    const Database = require('better-sqlite3');
    if (fs.existsSync(targetDbPath)) {
      const db = new Database(targetDbPath);
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
      console.log('[ELECTRON MAIN] Checkpoint WAL effectué avant fermeture.');
    }
  } catch (err) {
    console.error('[ELECTRON MAIN] Erreur checkpoint fermeture:', err);
  }
});
