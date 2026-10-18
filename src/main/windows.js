// windows.js — manage break / settings / stats windows.

const { BrowserWindow, screen, Notification } = require('electron');
const path = require('path');

let breakWindows = [];
let settingsWindow = null;
let statsWindow = null;
let preWarnWindow = null;

const PRELOAD = path.join(__dirname, '..', 'preload', 'preload.js');

function showBreak(state, settings) {
  const mode = settings.reminderMode || 'fullscreen';

  if (mode === 'notification') {
    if (Notification.isSupported()) {
      new Notification({
        title: 'EyeRest — 該休息了',
        body: `看 6 公尺外的物體 ${state.breakDurationSec} 秒，放鬆你的眼睛。`,
        silent: true, // Audio is controlled centrally, including volume and mute.
      }).show();
    }
    // For notification mode, also open a small floating window for the timer.
    openSmallReminder(state);
    return;
  }

  // fullscreen / overlay: cover every display.
  closeBreak();
  const displays = screen.getAllDisplays();
  breakWindows = displays.map((display) => {
    const { x, y, width, height } = display.bounds;
    const win = new BrowserWindow({
      x, y, width, height,
      frame: false,
      transparent: mode === 'overlay',
      backgroundColor: mode === 'overlay' ? '#00000000' : '#0c2a33',
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      fullscreenable: false,
      hasShadow: false,
      focusable: true,
      show: false,
      webPreferences: {
        preload: PRELOAD,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.loadFile(path.join(__dirname, '..', 'renderer', 'break', 'index.html'), {
      query: {
        mode,
        breakDurationSec: String(state.breakDurationSec),
        allowSkip: String(settings.allowSkip),
        soundEnabled: String(settings.soundEnabled),
        isLongBreak: String(state.isLongBreak === true),
      },
    });
    win.once('ready-to-show', () => win.show());
    return win;
  });
}

function openSmallReminder(state) {
  const display = screen.getPrimaryDisplay();
  const w = 360, h = 180;
  const x = display.workArea.x + display.workArea.width - w - 24;
  const y = display.workArea.y + display.workArea.height - h - 24;
  const win = new BrowserWindow({
    x, y, width: w, height: h,
    frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, resizable: false, hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'break', 'index.html'), {
    query: { mode: 'notification', breakDurationSec: String(state.breakDurationSec), allowSkip: 'true', isLongBreak: String(state.isLongBreak === true) },
  });
  breakWindows.push(win);
}

function closeBreak() {
  breakWindows.forEach((w) => {
    if (w && !w.isDestroyed()) w.destroy();
  });
  breakWindows = [];
}

function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return settingsWindow;
  }
  settingsWindow = new BrowserWindow({
    width: 1100, height: 800,
    minWidth: 560, minHeight: 480,
    icon: path.join(__dirname, '../../assets/icons/icon.png'),
    title: 'EyeRest — 設定',
    backgroundColor: '#f7faf9',
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings', 'index.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
  return settingsWindow;
}

function openStats() {
  if (statsWindow && !statsWindow.isDestroyed()) {
    statsWindow.focus();
    return statsWindow;
  }
  statsWindow = new BrowserWindow({
    width: 720, height: 520,
    title: 'EyeRest — 統計',
    backgroundColor: '#f7faf9',
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  statsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'stats', 'index.html'));
  statsWindow.on('closed', () => { statsWindow = null; });
  return statsWindow;
}

function showPreWarning(state) {
  closePreWarning();
  const display = screen.getPrimaryDisplay();
  const w = 360, h = 150;
  const x = display.workArea.x + display.workArea.width - w - 20;
  const y = display.workArea.y + display.workArea.height - h - 20;
  preWarnWindow = new BrowserWindow({
    x, y, width: w, height: h,
    frame: false, transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false, // the CSS card draws its own shadow
    backgroundColor: '#00000000',
    focusable: true,
    show: false,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  preWarnWindow.setAlwaysOnTop(true, 'screen-saver');
  const remainSec = Math.max(0, state.workDurationSec - state.workElapsedSec);
  preWarnWindow.loadFile(
    path.join(__dirname, '..', 'renderer', 'prewarn', 'index.html'),
    { query: { remainSec: String(remainSec) } },
  );
  const win = preWarnWindow;
  win.once('ready-to-show', () => { if (!win.isDestroyed()) win.show(); });
  win.on('closed', () => { if (preWarnWindow === win) preWarnWindow = null; });
}

function closePreWarning() {
  if (preWarnWindow && !preWarnWindow.isDestroyed()) preWarnWindow.destroy();
  preWarnWindow = null;
}

module.exports = {
  showBreak,
  closeBreak,
  openSettings,
  openStats,
  showPreWarning,
  closePreWarning,
};
