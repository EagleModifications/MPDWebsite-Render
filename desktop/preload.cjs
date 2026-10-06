const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('mpdDesktop', {
  isDesktopApp: true,
  platform: process.platform,
});
