// preload.js — exposes a small, safe API to renderer windows.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('eyerest', {
  // settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (partial) => ipcRenderer.invoke('settings:set', partial),
  pickGames: () => ipcRenderer.invoke('games:pick'),
  gamePauseSupported: process.platform === 'win32',
  // stats
  getStats: () => ipcRenderer.invoke('stats:get'),
  resetStats: () => ipcRenderer.invoke('stats:reset'),
  // timer controls
  getTimerState: () => ipcRenderer.invoke('timer:state'),
  openMiniTimerMenu: () => ipcRenderer.invoke('mini-timer:menu'),
  skipBreak: () => ipcRenderer.invoke('timer:skip-break'),
  snooze: (minutes) => ipcRenderer.invoke('timer:snooze', minutes),
  pauseToggle: () => ipcRenderer.invoke('timer:pause-toggle'),
  pauseFor: (minutes) => ipcRenderer.invoke('timer:pause-for', minutes),
  breakNow: () => ipcRenderer.invoke('timer:break-now'),
  postpone: (minutes) => ipcRenderer.invoke('timer:postpone', minutes),
  skipNextFromPreWarn: () => ipcRenderer.invoke('timer:skip-next-from-prewarn'),
  closePreWarn: () => ipcRenderer.invoke('prewarn:close'),
  // events
  onTick: (cb) => ipcRenderer.on('eyerest:tick', (_e, s) => cb(s)),
  onBreakStart: (cb) => ipcRenderer.on('eyerest:break-start', (_e, s) => cb(s)),
  onBreakEnd: (cb) => ipcRenderer.on('eyerest:break-end', (_e, s) => cb(s)),
  onIdleReset: (cb) => ipcRenderer.on('eyerest:idle-reset', (_e, s) => cb(s)),
  onPreWarning: (cb) => ipcRenderer.on('eyerest:pre-warning', (_e, s) => cb(s)),
  onSettings: (cb) => ipcRenderer.on('eyerest:settings', (_e, s) => cb(s)),
  onState: (cb) => ipcRenderer.on('eyerest:state', (_e, s) => cb(s)),
});
