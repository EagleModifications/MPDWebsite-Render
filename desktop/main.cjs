const { app, BrowserWindow, shell, session, dialog } = require('electron');
const path = require('node:path');
const { autoUpdater } = require('electron-updater');

const WEBSITE_URL = 'https://metropd-calirp.com';
const WEBSITE_ORIGIN = new URL(WEBSITE_URL).origin;
const UPDATE_FEED_URL = `${WEBSITE_URL}/api/desktop-updates/`;
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

  // Keep the GitHub repository private. electron-updater uses the public
  // MPD server as its generic update provider; the server proxies the
  // private GitHub release metadata and assets using its server-side token.
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: UPDATE_FEED_URL,
  });

  // Updates are never downloaded silently. The user explicitly approves
  // each update before electron-updater downloads it through the MPD server.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('checking-for-update', () => {
    console.log('[MPD Desktop] Checking for updates...');
  });

  autoUpdater.on('update-available', async (info) => {
    console.log(`[MPD Desktop] Update available: ${info.version}`);

    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Download update', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Metro Police Department Update Available',
      message: `Version ${info.version} is available.`,
      detail:
        'The update is downloaded securely through the Metro Police Department website. Choose Download update to install it, or Later to keep the current version installed.',
    });

    if (result.response === 0) {
      autoUpdater.downloadUpdate().catch((error) => {
        console.error('[MPD Desktop] Update download failed:', error);
      });
    }
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
