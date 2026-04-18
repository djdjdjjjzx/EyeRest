// tray.js — system tray icon & menu.

const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;
let handlers = {};
let isPaused = false;

function loadTrayIcon() {
  // Look for a real PNG; fall back to a tiny in-memory dot if none provided.
  const candidates = [
    path.join(__dirname, '..', '..', 'assets', 'icons', 'tray.png'),
    path.join(__dirname, '..', '..', 'assets', 'icons', 'icon.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      if (process.platform === 'darwin') img.setTemplateImage(true);
      return img;
    }
  }
  // 1x1 transparent PNG fallback so the app still launches without artwork.
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

function updateTrayMenu({ paused }) {
  isPaused = !!paused;
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: 'EyeRest', enabled: false },
    { type: 'separator' },
    { label: '立刻休息', click: () => handlers.onTakeBreakNow?.() },
    { label: '跳過下一次休息', click: () => handlers.onSkipNext?.() },
    {
      label: isPaused ? '繼續' : '暫停',
      click: () => handlers.onPauseToggle?.(),
    },
    { type: 'separator' },
    { label: '設定…', click: () => handlers.onOpenSettings?.() },
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
