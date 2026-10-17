// tray.js — system tray icon & menu.

const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;
let handlers = {};
let isPaused = false;

function loadTrayIcon() {
  const iconsDir = path.join(__dirname, '..', '..', 'assets', 'icons');
  const candidates = process.platform === 'darwin'
    ? ['tray-mac.png', 'tray-mac@2x.png', 'tray.png', 'icon.png']
    : ['tray.png', 'icon.png'];
  for (const name of candidates) {
    const p = path.join(iconsDir, name);
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      if (process.platform === 'darwin') img.setTemplateImage(true);
      return img;
    }
  }
  const buf = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFklEQVR4nGNgGAWjYBSMglEwCkYBPgAB8wABr4r8ZQAAAABJRU5ErkJggg==',
    'base64',
  );
  return nativeImage.createFromBuffer(buf);
}

function createTray(h) {
  handlers = h || {};
  tray = new Tray(loadTrayIcon());
  tray.setToolTip('EyeRest');
  updateTrayMenu({ paused: false });
  return tray;
}

function updateTrayMenu({ paused, pausedUntilMs }) {
  isPaused = Boolean(paused);
  let pauseLabel;
  if (isPaused) {
    if (pausedUntilMs) {
      const remainMs = Math.max(0, pausedUntilMs - Date.now());
      const remainMin = Math.ceil(remainMs / 60000);
      pauseLabel = `繼續（剩 ${remainMin} 分）`;
    } else {
      pauseLabel = '繼續';
    }
  } else {
    pauseLabel = '暫停';
  }
  if (tray == null) return;
  const menu = Menu.buildFromTemplate([
    { label: 'EyeRest', enabled: false },
    { type: 'separator' },
    { label: '立刻休息', click: () => handlers.onTakeBreakNow?.() },
    { label: '跳過下一次休息', click: () => handlers.onSkipNext?.() },
    { type: 'separator' },
    { label: pauseLabel, click: () => handlers.onPauseToggle?.() },
    {
      label: '定時暫停',
      enabled: isPaused === false,
      submenu: [
        { label: '15 分鐘', click: () => handlers.onPauseFor?.(15) },
        { label: '30 分鐘', click: () => handlers.onPauseFor?.(30) },
        { label: '1 小時',  click: () => handlers.onPauseFor?.(60) },
      ],
    },
    { type: 'separator' },
    { label: '設定…', click: () => handlers.onOpenSettings?.() },
    { label: '顯示倒數浮窗', click: () => handlers.onShowMiniTimer?.() },
    { label: '統計…', click: () => handlers.onOpenStats?.() },
    { type: 'separator' },
    { label: '結束 EyeRest', click: () => handlers.onQuit?.() },
  ]);
  tray.setContextMenu(menu);
}

function setTrayTooltip(text) {
  if (tray) tray.setToolTip(text);
}

module.exports = { createTray, updateTrayMenu, setTrayTooltip };
