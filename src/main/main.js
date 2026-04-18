// EyeRest — main process entry
// Handles app lifecycle, wires together timer / tray / windows / settings.

const { app, BrowserWindow, ipcMain, powerMonitor, nativeImage, screen } = require('electron');
const path = require('path');

const store = require('./store');
const { createTray, updateTrayMenu, setTrayTooltip } = require('./tray');
const { Timer } = require('./timer');
const { applyAutoLaunch } = require('./autostart');
const windows = require('./windows');

// Single-instance lock: prevent multiple EyeRest instances.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let timer;

function broadcast(channel, payload) {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send(channel, payload);
  });
}

function startApp() {
  // On macOS, hide from Dock — this is a tray-resident utility.
  if (process.platform === 'darwin' && app.dock) app.dock.hide();

  createTray({
    onOpenSettings: () => windows.openSettings(),
    onOpenStats: () => windows.openStats(),
    onPauseToggle: () => {
      const paused = timer.togglePause();
      updateTrayMenu({ paused });
      broadcast('eyerest:state', timer.getState());
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
      setTrayTooltip(formatTooltip(state));
      broadcast('eyerest:tick', state);
    },
    onBreakStart: (state) => {
      windows.closePreWarning();
      windows.showBreak(state, store.getSettings());
      broadcast('eyerest:break-start', state);
    },
    onBreakEnd: (state, completed) => {
      windows.closeBreak();
      if (completed) store.recordCompletedCycle(state.lastBreakDurationSec);
      broadcast('eyerest:break-end', { state, completed });
    },
    onIdleReset: (state) => {
      broadcast('eyerest:idle-reset', state);
    },
    onPreWarning: (state) => {
      windows.showPreWarning(state);
      broadcast('eyerest:pre-warning', state);
    },
  });

  timer.start();

  // Apply auto-launch based on stored setting.
  applyAutoLaunch(store.getSettings().autoLaunch).catch((err) => {
    console.error('Auto-launch error:', err);
  });

  registerIpc();
}

function formatTooltip(state) {
  if (state.paused) return 'EyeRest — 已暫停';
  if (state.phase === 'break') {
    const remain = Math.max(0, state.breakDurationSec - state.breakElapsedSec);
    return `EyeRest — 休息中 ${remain}s`;
  }
  const remainSec = Math.max(0, state.workDurationSec - state.workElapsedSec);
  const m = Math.floor(remainSec / 60);
  const s = remainSec % 60;
  return `EyeRest — 距下次休息 ${m}:${String(s).padStart(2, '0')}`;
}

function registerIpc() {
  ipcMain.handle('settings:get', () => store.getSettings());
  ipcMain.handle('settings:set', async (_e, partial) => {
    const updated = store.updateSettings(partial);
    if ('autoLaunch' in partial) {
      await applyAutoLaunch(updated.autoLaunch).catch(console.error);
    }
    timer.applySettings(updated);
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
    updateTrayMenu({ paused });
    return timer.getState();
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
    // Mark the upcoming break as skipped and reset the work cycle immediately.
    timer.skipNextBreak();
    // Advance workElapsed past duration so the skip fires on the next tick,
    // resetting the cycle without entering break.
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
  // If user re-launches, just open settings.
  windows.openSettings();
});

app.on('window-all-closed', (e) => {
  // Tray app: do not quit when windows close.
  e.preventDefault?.();
});

app.on('before-quit', () => {
  app.isQuiting = true;
});
