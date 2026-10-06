const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('node:path');

// Change this one value if the public website domain changes.
const WEBSITE_URL = process.env.MPD_DESKTOP_URL || 'https://metropd-calirp.com/';

let mainWindow = null;

function getDesktopUrl() {
  const url = new URL(WEBSITE_URL);
  url.searchParams.set('desktop', '1');
  // Forces a fresh request for the site's HTML on every app launch.
  url.searchParams.set('desktopLaunch', Date.now().toString());
  return url.toString();
}

function isAllowedNavigation(url) {
  try {
    return new URL(url).origin === new URL(WEBSITE_URL).origin;
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    show: false,
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    title: 'Metro Police Department',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.loadURL(getDesktopUrl()).catch(() => showOfflinePage());

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _description, _url, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) showOfflinePage();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function showOfflinePage() {
  if (!mainWindow) return;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Metro Police Department</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090909;color:#fff;font-family:Arial,sans-serif}main{width:min(520px,calc(100% - 40px));text-align:center}h1{margin:0 0 12px;font-size:28px}p{color:#a3a3a3;line-height:1.6}button{margin-top:12px;padding:11px 18px;border:0;border-radius:8px;background:#3b82f6;color:#fff;font-weight:600;cursor:pointer}
</style>
</head>
<body>
<main>
<h1>Metro Police Department</h1>
<p>The website could not be reached. Check your internet connection and try again.</p>
<button onclick="location.href=${JSON.stringify(getDesktopUrl())}">Try Again</button>
</main>
</body>
</html>`;

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

app.whenReady().then(async () => {
  // Clear stale cached HTML when the app starts. Render/Vite hashed assets remain cache-safe.
  await session.defaultSession.clearCache();
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
