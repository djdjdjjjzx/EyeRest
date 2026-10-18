// EyeRest — main process entry
// Handles app lifecycle, wires together timer / tray / windows / settings.

const { app, BrowserWindow, ipcMain, powerMonitor, nativeImage, screen, dialog } = require('electron');
const path = require('path');

const store = require('./store');
const { createTray, updateTrayMenu, setTrayTooltip } = require('./tray');
const { Timer } = require('./timer');
const { applyAutoLaunch } = require('./autostart');
const windows = require('./windows');
const miniTimer = require('./mini-timer');
const { playSound } = require('./sounds');
const sound = kind => playSound(kind, store.getSettings()).catch(console.error);

// Single-instance lock: prevent multiple EyeRest instances.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

const { GameMonitor } = require('./game-monitor');
let gameMonitor;
let timer;

function broadcast(channel, payload) {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send(channel, payload);
  });
}

function setMiniTimerVisible(visible) {
  const updated = store.updateSettings({ miniTimerEnabled: visible });
  miniTimer.sync(updated, openMiniTimerMenu);
  broadcast('eyerest:settings', updated);
}

function openMiniTimerMenu(event) {
  miniTimer.showMenu(event, timer, windows, () => setMiniTimerVisible(false));
}

function startApp() {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();

  createTray({
    onShowMiniTimer: () => setMiniTimerVisible(true),
    onOpenSettings: () => windows.openSettings(),
    onOpenStats: () => windows.openStats(),
    onPauseToggle: () => {
      const paused = timer.togglePause();
      const st = timer.getState();
      updateTrayMenu({ paused, pausedUntilMs: st.pausedUntilMs });
      broadcast('eyerest:state', st);
    },
    onPauseFor: (minutes) => {
      timer.pauseFor(minutes);
      const st = timer.getState();
      updateTrayMenu({ paused: st.paused, pausedUntilMs: st.pausedUntilMs });
      broadcast('eyerest:state', st);
    },
    onSkipNext: () => {
      timer.skipNextBreak();
      broadcast('eyerest:state', timer.getState());
    },
    onTakeBreakNow: () => timer.forceBreak(),
    onQuit: () => {
      app.isQuiting = true;
      app.quit();
    },
  });

  timer = new Timer({
    getSettings: () => store.getSettings(),
    getIdleSeconds: () => powerMonitor.getSystemIdleTime(),
    onTick: (state) => {
      if (state.idlePaused || state.suspended || state.paused) windows.closePreWarning();
      setTrayTooltip(formatTooltip(state));
      broadcast('eyerest:tick', state);
    },
    onBreakStart: (state) => {
      windows.closePreWarning();
      windows.showBreak(state, store.getSettings());
      sound('start');
      broadcast('eyerest:break-start', state);
    },
    onBreakEnd: (state, completed) => {
      windows.closeBreak();
      if (completed) {
        store.recordCompletedCycle(state.lastBreakDurationSec);
        sound('end');
      }
      broadcast('eyerest:break-end', { state, completed });
    },
    onIdleReset: (state) => {
      windows.closePreWarning();
      broadcast('eyerest:idle-reset', state);
    },
    onPreWarning: (state) => {
      windows.showPreWarning(state);
      broadcast('eyerest:pre-warning', state);
    },
    onPauseChange: (state) => {
      if (state.paused) windows.closePreWarning();
      updateTrayMenu({ paused: state.paused, pausedUntilMs: state.pausedUntilMs });
      broadcast('eyerest:state', state);
    },
  });

  gameMonitor = new GameMonitor((name, error) => {
    timer.setGamePause(name, error);
    if (name && timer.phase === 'work') windows.closePreWarning();
  });
  gameMonitor.configure(store.getSettings());
  timer.start();
  powerMonitor.on('suspend', () => timer.suspend());
  powerMonitor.on('resume', () => timer.resume());

  applyAutoLaunch(store.getSettings().autoLaunch).catch((err) => {
    console.error('Auto-launch error:', err);
  });

  registerIpc();
  miniTimer.sync(store.getSettings(), openMiniTimerMenu);
}

function formatTooltip(state) {
  if (state.paused) {
    if (state.pausedUntilMs) {
      const ms = Math.max(0, state.pausedUntilMs - Date.now());
      const m = Math.ceil(ms / 60000);
      return `EyeRest — 已暫停（剩 ${m} 分）`;
    }
    return 'EyeRest — 已暫停';
  }
  if (state.gamePauseName) return `EyeRest — 遊戲中，倒數已暫停（${state.gamePauseName}）`;
  if (state.idlePaused) return state.idleReset
    ? 'EyeRest — 閒置已重設，等待回來後倒數'
    : 'EyeRest — 閒置暫停，保留剩餘時間';
  if (state.phase === 'break') {
    const remain = Math.max(0, state.breakDurationSec - state.breakElapsedSec);
    return `EyeRest — 休息中 ${remain}s${state.isLongBreak ? '（長休息）' : ''}`;
  }
  const remainSec = Math.max(0, state.workDurationSec - state.workElapsedSec);
  const m = Math.floor(remainSec / 60);
  const s = remainSec % 60;
  const tag = state.nextBreakIsLong ? '（下次為長休息）' : '';
  return `EyeRest — 距下次休息 ${m}:${String(s).padStart(2, '0')}${tag}`;
}

function registerIpc() {
  ipcMain.handle('sound:preview', (_event, kind) => playSound(kind, store.getSettings(), true));
  ipcMain.handle('mini-timer:menu', openMiniTimerMenu);
  ipcMain.handle('games:pick', async (event) => {
    if (process.platform !== 'win32') return [];
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
      title: '選擇遊戲執行檔（請選實際遊戲，不是啟動器）',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '遊戲執行檔', extensions: ['exe'] }],
    });
    if (result.canceled) return [];
    const updated = store.updateSettings({ gamePaths: [...store.getSettings().gamePaths, ...result.filePaths] });
    gameMonitor.configure(updated);
    broadcast('eyerest:settings', updated);
    return updated.gamePaths;
  });
  ipcMain.handle('settings:get' , () => store.getSettings());
  ipcMain.handle('settings:set', async (_e, partial) => {
    const updated = store.updateSettings(partial);
    if ('autoLaunch' in partial) {
      await applyAutoLaunch(updated.autoLaunch).catch(console.error);
    }
    timer.applySettings(updated);
    if (!updated.preWarningEnabled) windows.closePreWarning();
    gameMonitor.configure(updated);
    miniTimer.sync(updated, openMiniTimerMenu);
    broadcast('eyerest:settings', updated);
    return updated;
  });
  ipcMain.handle('stats:get', () => store.getStats());
  ipcMain.handle('stats:reset', () => store.resetStats());
  ipcMain.handle('timer:state', () => timer.getState());
  ipcMain.handle('timer:skip-break', () => {
    timer.endBreakEarly();
    return timer.getState();
  });
  ipcMain.handle('timer:snooze', (_e, minutes = 5) => {
    timer.snooze(minutes);
    return timer.getState();
  });
  ipcMain.handle('timer:pause-toggle', () => {
    const paused = timer.togglePause();
    const st = timer.getState();
    updateTrayMenu({ paused, pausedUntilMs: st.pausedUntilMs });
    return st;
  });
  ipcMain.handle('timer:pause-for', (_e, minutes) => {
    timer.pauseFor(Number(minutes) || 15);
    const st = timer.getState();
    updateTrayMenu({ paused: st.paused, pausedUntilMs: st.pausedUntilMs });
    return st;
  });
  ipcMain.handle('timer:break-now', () => {
    timer.forceBreak();
    return timer.getState();
  });
  ipcMain.handle('timer:postpone', (_e, minutes = 1) => {
    timer.postpone(Number(minutes) || 1);
    windows.closePreWarning();
    broadcast('eyerest:tick', timer.getState());
    return timer.getState();
  });
  ipcMain.handle('timer:skip-next-from-prewarn', () => {
    timer.skipNextBreak();
    const s = timer.getState();
    timer.workElapsedSec = s.workDurationSec;
    windows.closePreWarning();
    broadcast('eyerest:tick', timer.getState());
    return timer.getState();
  });
  ipcMain.handle('prewarn:close', () => {
    windows.closePreWarning();
  });
}

app.whenReady().then(startApp);

app.on('second-instance', () => {
  windows.openSettings();
});

app.on('window-all-closed', (e) => {
  e.preventDefault?.();
});

app.on('before-quit', () => {
  gameMonitor?.stop();
  timer?.stop();
  app.isQuiting = true;
});
