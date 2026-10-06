const { app, BrowserWindow, shell, session, dialog } = require('electron');
const path = require('node:path');
const { autoUpdater } = require('electron-updater');

const WEBSITE_URL = 'https://metropd-calirp.com';
const WEBSITE_ORIGIN = new URL(WEBSITE_URL).origin;
const APP_ICON = path.join(__dirname, 'icon.png');

let mainWindow = null;
let updatePromptShown = false;
let quittingForUpdate = false;

function isAllowedNavigation(url) {
  return (
    url === WEBSITE_ORIGIN ||
    url.startsWith(`${WEBSITE_ORIGIN}/`) ||
    url.startsWith('https://discord.com/') ||
    url.startsWith('https://discordapp.com/')
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#09090b',
    icon: APP_ICON,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url)) {
      return { action: 'allow' };
    }

    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedNavigation(url)) {
      return;
    }

    event.preventDefault();
    shell.openExternal(url).catch(() => {});
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[MPD Desktop] Website failed to load: ${errorCode} ${errorDescription}`);
  });

  mainWindow.loadURL(WEBSITE_URL).catch((error) => {
    console.error('[MPD Desktop] Failed to load website:', error);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function configureSecurity() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: details.responseHeaders });
  });
}

function configureAutoUpdater() {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('checking-for-update', () => {
    console.log('[MPD Desktop] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`[MPD Desktop] Update available: ${info.version}`);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log(`[MPD Desktop] Already up to date: ${info.version}`);
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[MPD Desktop] Update download: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    if (updatePromptShown || !mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    updatePromptShown = true;

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Restart and Update', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Metro Police Department Update',
      message: `Version ${info.version} is ready to install.`,
      detail:
        'The update has been downloaded. Restart now to install it, or choose Later to install it when the application closes.',
    });

    if (result.response === 0) {
      quittingForUpdate = true;
      autoUpdater.quitAndInstall(false, true);
    } else {
      updatePromptShown = false;
    }
  });

  autoUpdater.on('error', (error) => {
    console.error('[MPD Desktop] Auto-update error:', error);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.error('[MPD Desktop] Update check failed:', error);
    });
  }, 3000);
}

app.whenReady().then(() => {
  configureSecurity();
  createWindow();
  configureAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (quittingForUpdate) {
    return;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
