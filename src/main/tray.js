const { t } = require('./i18n');
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
      pauseLabel = t("繼續（剩 {p0} 分）", { p0: remainMin });
    } else {
      pauseLabel = t("繼續");
    }
  } else {
    pauseLabel = t("暫停");
  }
  if (tray == null) return;
  const menu = Menu.buildFromTemplate([
    { label: 'EyeRest', enabled: false },
    { type: 'separator' },
    { label: t("立刻休息"), click: () => handlers.onTakeBreakNow?.() },
    { label: t("跳過下一次休息"), click: () => handlers.onSkipNext?.() },
    { type: 'separator' },
    { label: pauseLabel, click: () => handlers.onPauseToggle?.() },
    {
      label: t("定時暫停"),
      enabled: isPaused === false,
      submenu: [
        { label: t("15 分鐘"), click: () => handlers.onPauseFor?.(15) },
        { label: t("30 分鐘"), click: () => handlers.onPauseFor?.(30) },
        { label: t("1 小時"),  click: () => handlers.onPauseFor?.(60) },
      ],
    },
    { type: 'separator' },
    { label: t("設定…"), click: () => handlers.onOpenSettings?.() },
    { label: t("顯示倒數浮窗"), click: () => handlers.onShowMiniTimer?.() },
    { label: t("統計…"), click: () => handlers.onOpenStats?.() },
    { type: 'separator' },
    { label: t("結束 EyeRest"), click: () => handlers.onQuit?.() },
  ]);
  tray.setContextMenu(menu);
}

function setTrayTooltip(text) {
  if (tray) tray.setToolTip(text);
}

module.exports = { createTray, updateTrayMenu, setTrayTooltip };
