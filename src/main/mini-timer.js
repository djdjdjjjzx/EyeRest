const { BrowserWindow, Menu, screen } = require('electron');
const path = require('path');
const store = require('./store');

const WIDTH = 204;
const HEIGHT = 76;
let win = null;
let activeMenu = null;
let idleOpacity = 35;
let lastAppearance = '';

function updateAppearance() {
  if (!win || win.isDestroyed()) return;
  const { x, y } = screen.getCursorScreenPoint();
  const bounds = win.getBounds();
  const margin = 32;
  const active = !!activeMenu || (x >= bounds.x - margin && x <= bounds.x + bounds.width + margin
    && y >= bounds.y - margin && y <= bounds.y + bounds.height + margin);
  const appearance = { active, opacity: idleOpacity / 100 };
  const key = JSON.stringify(appearance);
  if (key === lastAppearance) return;
  lastAppearance = key;
  win.webContents.send('eyerest:mini-appearance', appearance);
}

function closeMenu() {
  if (!activeMenu) return;
  const menu = activeMenu;
  activeMenu = null;
  menu.closePopup(win && !win.isDestroyed() ? win : undefined);
  updateAppearance();
}

function positionOnScreen(position) {
  const valid = position && Number.isFinite(position.x) && Number.isFinite(position.y);
  const display = valid
    ? screen.getDisplayNearestPoint({ x: Math.round(position.x), y: Math.round(position.y) })
    : screen.getPrimaryDisplay();
  const area = display.workArea;
  return {
    x: Math.round(Math.max(area.x, Math.min(valid ? position.x : area.x + area.width - WIDTH - 20, area.x + area.width - WIDTH))),
    y: Math.round(Math.max(area.y, Math.min(valid ? position.y : area.y + area.height - HEIGHT - 20, area.y + area.height - HEIGHT))),
  };
}

function ensureVisible() {
  if (!win || win.isDestroyed()) return;
  const bounds = win.getBounds();
  const next = positionOnScreen(bounds);
  if (bounds.x !== next.x || bounds.y !== next.y) win.setPosition(next.x, next.y);
}

function sync(settings, onContextMenu) {
  idleOpacity = settings.miniTimerOpacity ?? 35;
  if (!settings.miniTimerEnabled) {
    closeMenu();
    if (win) win.destroy();
    return;
  }
  if (win && !win.isDestroyed()) {
    updateAppearance();
    return;
  }
  win = new BrowserWindow({
    ...positionOnScreen(settings.miniTimerPosition), width: WIDTH, height: HEIGHT,
    frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true,
    resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    focusable: true, hasShadow: false, show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  const current = win;
  lastAppearance = '';
  current.webContents.on('did-finish-load', () => {
    lastAppearance = '';
    updateAppearance();
  });
  const proximityTimer = setInterval(updateAppearance, 120);
  const openContextMenu = (event) => {
    event.preventDefault();
    if (onContextMenu) onContextMenu({ sender: current.webContents });
  };
  current.webContents.on('context-menu', openContextMenu);
  // Windows handles right clicks on the native drag region separately.
  current.on('system-context-menu', openContextMenu);
  // Native popup menus need a focusable owner to dismiss on outside clicks.
  // Showing the timer itself still uses showInactive, so startup never takes focus.
  current.on('blur', closeMenu);
  current.on('close', closeMenu);
  current.loadFile(path.join(__dirname, '..', 'renderer', 'mini-timer', 'index.html'));
  current.once('ready-to-show', () => { if (!current.isDestroyed()) current.showInactive(); });
  current.on('moved', () => {
    ensureVisible();
    if (!current.isDestroyed()) {
      const { x, y } = current.getBounds();
      store.updateSettings({ miniTimerPosition: { x, y } });
    }
  });
  screen.on('display-removed', ensureVisible);
  screen.on('display-metrics-changed', ensureVisible);
  current.on('closed', () => {
    clearInterval(proximityTimer);
    screen.removeListener('display-removed', ensureVisible);
    screen.removeListener('display-metrics-changed', ensureVisible);
    win = null;
  });
}

function showMenu(event, timer, windows, onHide) {
  if (!win || event.sender !== win.webContents) return;
  if (activeMenu) {
    closeMenu();
    return;
  }
  const working = timer.getState().phase === 'work';
  const extend = (minutes) => {
    if (timer.getState().phase !== 'work') return;
    windows.closePreWarning();
    timer.extendWork(minutes);
  };
  const menu = Menu.buildFromTemplate([
    { label: '再 1 分鐘', enabled: working, click: () => extend(1) },
    { label: '再 3 分鐘', enabled: working, click: () => extend(3) },
    { label: '立即下一次休息', enabled: working, click: () => {
      if (timer.getState().phase !== 'work') return;
      if (timer.paused) timer.togglePause();
      timer.forceBreak();
    } },
    { label: timer.getState().paused ? '開始計時' : '暫停計時', click: () => {
      const paused = timer.togglePause();
      if (paused) windows.closePreWarning();
    } },
    { label: '隱藏', click: () => onHide() },
  ]);
  win.focus();
  activeMenu = menu;
  updateAppearance();
  menu.popup({ window: win, callback: () => {
    if (activeMenu === menu) activeMenu = null;
    updateAppearance();
  } });
}

module.exports = { sync, showMenu };
