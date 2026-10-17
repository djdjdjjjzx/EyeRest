// timer.js — core 20-20-20 state machine with idle-aware reset + pre-warning
// + long-break cycling + skip penalty + timed pause.
//
// Phases: 'work' | 'break' | 'paused'
//
// Long break cycling:
//   * Every Nth break is a "long break" (longBreakDurationSec, e.g. 3 min).
//   * Pattern: 1, 2, LONG, 1, 2, LONG. N = longBreakEvery (default 3).
//
// Skip penalty:
//   * When the user skips an upcoming break (tray "跳過下一次" or pre-warning
//     Skip), if forceLongBreakAfterSkip is on, nextBreakIsLong is set so the
//     next break taken is long.
//   * Does NOT apply to skipping a break already in progress (Esc during overlay).
//
// Timed pause:
//   * pauseFor(minutes) pauses + auto-resumes via setTimeout after `minutes`.
//   * State exposes pausedUntilMs for UI countdown.

class Timer {
  constructor({
    getSettings,
    getIdleSeconds,
    onTick,
    onBreakStart,
    onBreakEnd,
    onIdleReset,
    onPreWarning,
    onPauseChange,
  }) {
    this.getSettings = getSettings;
    this.getIdleSeconds = getIdleSeconds;
    this.onTick = onTick || (() => {});
    this.onBreakStart = onBreakStart || (() => {});
    this.onBreakEnd = onBreakEnd || (() => {});
    this.onIdleReset = onIdleReset || (() => {});
    this.onPreWarning = onPreWarning || (() => {});
    this.onPauseChange = onPauseChange || (() => {});

    const s = getSettings();
    this.workDurationSec = s.workDurationSec;
    this.breakDurationSec = s.breakDurationSec;
    this.idleThresholdSec = s.idleThresholdSec;
    this.preWarningSec = s.preWarningSec;
    this.preWarningEnabled = s.preWarningEnabled;
    this.longBreakEnabled = s.longBreakEnabled !== false;
    this.longBreakDurationSec = s.longBreakDurationSec || 180;
    this.longBreakEvery = s.longBreakEvery || 3;
    this.forceLongBreakAfterSkip = s.forceLongBreakAfterSkip !== false;

    this.phase = 'work';
    this.workElapsedSec = 0;
    this.breakElapsedSec = 0;
    this.gamePauseName = '';
    this.gameDetectionError = false;
    this.paused = false;
    this.pausedUntilMs = null;
    this._pauseTimeout = null;
    this.skipNext = false;
    this.nextBreakIsLong = false;
    this.breaksTaken = 0;
    this.idleResetArmed = true;
    this.preWarningFired = false;
    this.lastBreakDurationSec = 0;
    this.currentBreakDurationSec = this.breakDurationSec;
    this.currentBreakIsLong = false;

    this._interval = null;
  }

  applySettings(s) {
    this.workDurationSec = s.workDurationSec;
    this.breakDurationSec = s.breakDurationSec;
    this.idleThresholdSec = s.idleThresholdSec;
    this.preWarningSec = s.preWarningSec;
    this.preWarningEnabled = s.preWarningEnabled;
    this.longBreakEnabled = s.longBreakEnabled !== false;
    this.longBreakDurationSec = s.longBreakDurationSec || this.longBreakDurationSec;
    this.longBreakEvery = s.longBreakEvery || this.longBreakEvery;
    this.forceLongBreakAfterSkip = s.forceLongBreakAfterSkip !== false;
  }

  start() {
    if (this._interval) return;
    this._interval = setInterval(() => this._tick(), 1000);
  }

  stop() {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
    this._clearPauseTimeout();
  }

  _clearPauseTimeout() {
    if (this._pauseTimeout) {
      clearTimeout(this._pauseTimeout);
      this._pauseTimeout = null;
    }
    this.pausedUntilMs = null;
  }

  setGamePause(name, error = false) {
    if (this.gamePauseName === name && this.gameDetectionError === error) return;
    const wasGaming = !!this.gamePauseName;
    this.gamePauseName = name;
    this.gameDetectionError = error;
    // Ignore controller-only idle time until keyboard/mouse activity resumes.
    if (wasGaming && !name) this.ignoreGameIdle = true;
    if (name && this.phase === 'work') this.preWarningFired = false;
    this.onTick(this.getState());
  }

  togglePause() {
    this.paused = !this.paused;
    this._clearPauseTimeout();
    this.onPauseChange(this.getState());
    this.onTick(this.getState());
    return this.paused;
  }

  pauseFor(minutes) {
    const mins = Math.max(1, Math.floor(Number(minutes) || 0));
    this._clearPauseTimeout();
    this.paused = true;
    this.pausedUntilMs = Date.now() + mins * 60 * 1000;
    this._pauseTimeout = setTimeout(() => {
      this._pauseTimeout = null;
      this.pausedUntilMs = null;
      this.paused = false;
      this.onPauseChange(this.getState());
      this.onTick(this.getState());
    }, mins * 60 * 1000);
    this.onPauseChange(this.getState());
    this.onTick(this.getState());
    return this.paused;
  }

  skipNextBreak() {
    this.skipNext = true;
    if (this.forceLongBreakAfterSkip && this.longBreakEnabled) {
      this.nextBreakIsLong = true;
    }
  }

  endBreakEarly() {
    if (this.phase !== 'break') return;
    this._endBreak(false);
  }

  snooze(minutes = 5) {
    this.postpone(minutes);
  }

  postpone(minutes) {
    if (this.phase !== 'work') return;
    const wantRemain = Math.max(0, Math.floor(minutes * 60));
    this.workElapsedSec = Math.max(0, this.workDurationSec - wantRemain);
    this.preWarningFired = false;
  }

  forceBreak() {
    if (this.phase !== 'work') return;
    this._startBreak();
  }

  getState() {
    const activeBreakDuration = this.phase === 'break'
      ? this.currentBreakDurationSec
      : this._predictNextBreakDuration();
    return {
      phase: this.phase,
      gamePauseName: this.phase === 'work' ? this.gamePauseName : '',
      gameDetectionError: this.gameDetectionError,
      paused: this.paused,
      pausedUntilMs: this.pausedUntilMs,
      workElapsedSec: this.workElapsedSec,
      breakElapsedSec: this.breakElapsedSec,
      workDurationSec: this.workDurationSec,
      breakDurationSec: activeBreakDuration,
      normalBreakDurationSec: this.breakDurationSec,
      longBreakDurationSec: this.longBreakDurationSec,
      idleThresholdSec: this.idleThresholdSec,
      preWarningSec: this.preWarningSec,
      preWarningEnabled: this.preWarningEnabled,
      preWarningFired: this.preWarningFired,
      lastBreakDurationSec: this.lastBreakDurationSec,
      skipNext: this.skipNext,
      nextBreakIsLong: this.nextBreakIsLong,
      isLongBreak: this.phase === 'break' ? this.currentBreakIsLong : false,
      breaksTaken: this.breaksTaken,
      longBreakEnabled: this.longBreakEnabled,
      longBreakEvery: this.longBreakEvery,
    };
  }

  _predictNextBreakDuration() {
    return this._decideNextBreakIsLong() ? this.longBreakDurationSec : this.breakDurationSec;
  }

  _decideNextBreakIsLong() {
    if (!this.longBreakEnabled) return false;
    if (this.nextBreakIsLong) return true;
    const n = this.longBreakEvery;
    if (n < 2) return false;
    return ((this.breaksTaken + 1) % n) === 0;
  }

  _tick() {
    if (this.paused) {
      this.onTick(this.getState());
      return;
    }

    if (this.phase === 'work') {
      if (this.gamePauseName) {
        this.onTick(this.getState());
        return;
      }
      const idleSec = Math.max(0, Math.floor(this.getIdleSeconds()));

      if (idleSec < this.idleThresholdSec) this.ignoreGameIdle = false;
      if (idleSec >= this.idleThresholdSec && !this.ignoreGameIdle) {
        if (this.workElapsedSec > 0 && this.idleResetArmed) {
          this.workElapsedSec = 0;
          this.preWarningFired = false;
          this.idleResetArmed = false;
          this.onIdleReset(this.getState());
        }
        this.onTick(this.getState());
        return;
      }

      this.idleResetArmed = true;
      this.workElapsedSec += 1;

      if (
        this.preWarningEnabled &&
        !this.preWarningFired &&
        this.preWarningSec > 0 &&
        this.workElapsedSec >= this.workDurationSec - this.preWarningSec &&
        this.workElapsedSec < this.workDurationSec
      ) {
        this.preWarningFired = true;
        this.onPreWarning(this.getState());
      }

      if (this.workElapsedSec >= this.workDurationSec) {
        if (this.skipNext) {
          this.skipNext = false;
          this.workElapsedSec = 0;
          this.preWarningFired = false;
          this.onTick(this.getState());
          return;
        }
        this._startBreak();
        return;
      }

      this.onTick(this.getState());
      return;
    }

    if (this.phase === 'break') {
      this.breakElapsedSec += 1;
      if (this.breakElapsedSec >= this.currentBreakDurationSec) {
        this._endBreak(true);
      } else {
        this.onTick(this.getState());
      }
    }
  }

  _startBreak() {
    const isLong = this._decideNextBreakIsLong();
    this.currentBreakIsLong = isLong;
    this.currentBreakDurationSec = isLong
      ? this.longBreakDurationSec
      : this.breakDurationSec;
    this.nextBreakIsLong = false;
    this.phase = 'break';
    this.breakElapsedSec = 0;
    this.breaksTaken += 1;
    this.onBreakStart(this.getState());
  }

  _endBreak(completed) {
    this.lastBreakDurationSec = this.breakElapsedSec;
    this.phase = 'work';
    this.workElapsedSec = 0;
    this.breakElapsedSec = 0;
    this.idleResetArmed = true;
    this.preWarningFired = false;
    this.currentBreakIsLong = false;
    this.currentBreakDurationSec = this.breakDurationSec;
    this.onBreakEnd(this.getState(), completed);
  }
}

module.exports = { Timer };
