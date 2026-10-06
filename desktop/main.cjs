const { app, BrowserWindow, shell, session, dialog } = require('electron');
const path = require('node:path');
const { autoUpdater } = require('electron-updater');

const WEBSITE_URL = 'https://metropd-calirp.com';
const WEBSITE_ORIGIN = new URL(WEBSITE_URL).origin;

let mainWindow = null;
let updatePromptShown = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#09090b',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(WEBSITE_ORIGIN)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(WEBSITE_ORIGIN) || url.startsWith('https://discord.com/') || url.startsWith('https://discordapp.com/')) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.loadURL(WEBSITE_URL);
  mainWindow.on('closed', () => { mainWindow = null; });
}

function configureSecurity() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: details.responseHeaders });
  });
}

function configureAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('checking-for-update', () => console.log('[MPD Desktop] Checking for updates...'));
  autoUpdater.on('update-available', info => console.log(`[MPD Desktop] Update available: ${info.version}`));
  autoUpdater.on('update-not-available', info => console.log(`[MPD Desktop] Already up to date: ${info.version}`));
  autoUpdater.on('download-progress', progress => console.log(`[MPD Desktop] Update download: ${Math.round(progress.percent)}%`));

  autoUpdater.on('update-downloaded', async info => {
    if (updatePromptShown) return;
    updatePromptShown = true;

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Restart and Update', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Metro Police Department Update',
      message: `Version ${info.version} is ready to install.`,
      detail: 'The update has already been downloaded. Restart now to install it, or choose Later to install it when the app next closes.',
    });

    if (result.response === 0) autoUpdater.quitAndInstall(false, true);
  });

  autoUpdater.on('error', error => console.error('[MPD Desktop] Auto-update error:', error));

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(error => console.error('[MPD Desktop] Update check failed:', error));
  }, 2500);
}

app.whenReady().then(() => {
  configureSecurity();
  createWindow();
  configureAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
