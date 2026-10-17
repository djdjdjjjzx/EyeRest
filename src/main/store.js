// store.js — persistent settings & stats using electron-store.

const Store = require('electron-store');

const DEFAULT_SETTINGS = {
  workDurationSec: 20 * 60,   // 20 minutes
  breakDurationSec: 20,       // 20 seconds (normal break)
  idleThresholdSec: 2 * 60,   // 2 minutes
  reminderMode: 'fullscreen', // 'fullscreen' | 'overlay' | 'notification'
  soundEnabled: true,
  autoLaunch: false,
  gamePauseEnabled: false,
  gamePaths: [],
  allowSkip: true,
  allowSnooze: true,
  snoozeMinutes: 5,
  // Pre-warning: small corner popup before the break with +1 / +5 / Skip buttons.
  preWarningEnabled: true,
  preWarningSec: 60,          // 1 minute before break
  // Long break: every Nth break is a longer "deep rest". Pomodoro-like.
  longBreakEnabled: true,
  longBreakDurationSec: 180,  // 3 minutes
  longBreakEvery: 3,          // every 3rd break is long
  // Skip penalty: if user skips an upcoming break, force the next one to be long.
  forceLongBreakAfterSkip: true,
  theme: 'mountain',
};

// Lazy initialization — electron-store depends on app.getPath('userData'),
// which is only reliable after app.whenReady(). Callers here always run
// post-ready, so this is safe.
let _store = null;
function store() {
  if (_store) return _store;
  _store = new Store({
    name: 'eyerest-config',
    defaults: {
      settings: DEFAULT_SETTINGS,
      stats: {}, // keyed by 'YYYY-MM-DD' -> { cycles, totalRestSec }
    },
  });
  return _store;
}

function clamp(n, min, max) {
  n = Number(n);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...store().get('settings', {}) };
}

function updateSettings(partial) {
  const next = { ...getSettings(), ...partial };
  next.workDurationSec = clamp(next.workDurationSec, 60, 60 * 60 * 4);
  next.breakDurationSec = clamp(next.breakDurationSec, 5, 60 * 30);
  next.idleThresholdSec = clamp(next.idleThresholdSec, 30, 60 * 60);
  next.snoozeMinutes = clamp(next.snoozeMinutes, 1, 60);
  next.preWarningSec = clamp(next.preWarningSec, 10, 600);
  next.longBreakDurationSec = clamp(next.longBreakDurationSec, 30, 60 * 30);
  next.longBreakEvery = clamp(next.longBreakEvery, 2, 20);
  next.gamePauseEnabled = next.gamePauseEnabled === true;
  const { normalizeGamePath } = require('./game-monitor');
  next.gamePaths = [...new Set((Array.isArray(next.gamePaths) ? next.gamePaths : []).map(normalizeGamePath).filter(Boolean))];
  store().set('settings', next);
  return next;
}

function recordCompletedCycle(restSec) {
  const today = new Date().toISOString().slice(0, 10);
  const stats = store().get('stats') || {};
  const day = stats[today] || { cycles: 0, totalRestSec: 0 };
  day.cycles += 1;
  day.totalRestSec += restSec || 0;
  stats[today] = day;
  store().set('stats', stats);
}

function getStats() {
  return store().get('stats') || {};
}

function resetStats() {
  store().set('stats', {});
}

module.exports = {
  getSettings,
  updateSettings,
  recordCompletedCycle,
  getStats,
  resetStats,
  DEFAULT_SETTINGS,
};
