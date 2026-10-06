import { app, BrowserWindow, Menu, shell, session } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEBSITE_URL = "https://metropd-calirp.com/";

let mainWindow: BrowserWindow | null = null;

function isAllowedWebsite(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "metropd-calirp.com";
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
    autoHideMenuBar: true,
    backgroundColor: "#0a0a0a",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowedWebsite(url)) {
      void shell.openExternal(url);
    }

    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedWebsite(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // The timestamp prevents an old cached document from being used after Render deploys.
  const launchUrl = new URL(WEBSITE_URL);
  launchUrl.searchParams.set("desktop", "1");
  launchUrl.searchParams.set("launch", Date.now().toString());

  void mainWindow.loadURL(launchUrl.toString(), {
    extraHeaders: "Cache-Control: no-cache\n"
  });
}

app.setAppUserModelId("com.opslinksystems.metropd");

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  // Keep the desktop app isolated from Electron's local file origins.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = permission === "notifications" || permission === "media";
    callback(allowed);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
