// timer.js — core 20-20-20 state machine with idle-aware reset + pre-warning.
//
// Phases: 'work' | 'break' | 'paused'
//
// Work phase:
//   * Each tick (1s) we read powerMonitor.getSystemIdleTime() (in seconds).
//   * If idleSec >= idleThreshold while in work → reset workElapsed to 0.
//     (User walked away → eyes already rested → restart the work cycle.)
//   * If user comes back (idle drops), we just continue from 0.
//   * When workElapsed reaches (workDuration - preWarningSec) → fire onPreWarning
//     ONCE per cycle. (Renderer pops up the small "1 min to break" window.)
//   * When workElapsed >= workDuration → enter break phase.
//
// Break phase:
//   * Counts down breakDurationSec and then ends.
//   * User can skip early (counts as incomplete) or wait full duration (completes).
//
// Postpone:
//   * postpone(minutes): set workElapsed so the break happens `minutes` from now.
//   * Resets the pre-warning flag so a new warning will fire 60s before the new
//     break (if minutes > preWarningSec/60).

class Timer {
  constructor({ getSettings, getIdleSeconds, onTick, onBreakStart, onBreakEnd, onIdleReset, onPreWarning }) {
    this.getSettings = getSettings;
    this.getIdleSeconds = getIdleSeconds;
    this.onTick = onTick || (() => {});
    this.onBreakStart = onBreakStart || (() => {});
    this.onBreakEnd = onBreakEnd || (() => {});
    this.onIdleReset = onIdleReset || (() => {});
    this.onPreWarning = onPreWarning || (() => {});

    const s = getSettings();
    this.workDurationSec = s.workDurationSec;
    this.breakDurationSec = s.breakDurationSec;
    this.idleThresholdSec = s.idleThresholdSec;
    this.preWarningSec = s.preWarningSec;
    this.preWarningEnabled = s.preWarningEnabled;

    this.phase = 'work';
    this.workElapsedSec = 0;
    this.breakElapsedSec = 0;
    this.paused = false;
    this.skipNext = false;
    this.idleResetArmed = true;
    this.preWarningFired = false; // reset whenever a new work cycle begins or postpone is called
    this.lastBreakDurationSec = 0;

    this._interval = null;
  }

  applySettings(s) {
    this.workDurationSec = s.workDurationSec;
    this.breakDurationSec = s.breakDurationSec;
    this.idleThresholdSec = s.idleThresholdSec;
    this.preWarningSec = s.preWarningSec;
    this.preWarningEnabled = s.preWarningEnabled;
  }

  start() {
    if (this._interval) return;
    this._interval = setInterval(() => this._tick(), 1000);
  }

  stop() {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
  }

  togglePause() {
    this.paused = !this.paused;
    this.onTick(this.getState());
    return this.paused;
  }

  skipNextBreak() {
    this.skipNext = true;
  }

  endBreakEarly() {
    if (this.phase !== 'break') return;
    this._endBreak(false);
  }

  /** Snooze (used by tray menu): postpone the next break by N minutes. Same as postpone. */
  snooze(minutes = 5) {
    this.postpone(minutes);
  }

  /**
   * Postpone: ensure the break happens exactly `minutes` minutes from now.
   * Used by both the snooze tray action and the pre-warning popup buttons.
   */
  postpone(minutes) {
    if (this.phase !== 'work') return;
    const wantRemain = Math.max(0, Math.floor(minutes * 60));
    this.workElapsedSec = Math.max(0, this.workDurationSec - wantRemain);
    // Allow a fresh pre-warning to fire for the new schedule.
    this.preWarningFired = false;
  }

  forceBreak() {
    if (this.phase !== 'work') return;
    this._startBreak();
  }

  getState() {
    return {
      phase: this.phase,
      paused: this.paused,
      workElapsedSec: this.workElapsedSec,
      breakElapsedSec: this.breakElapsedSec,
      workDurationSec: this.workDurationSec,
      breakDurationSec: this.breakDurationSec,
      idleThresholdSec: this.idleThresholdSec,
      preWarningSec: this.preWarningSec,
      preWarningEnabled: this.preWarningEnabled,
      preWarningFired: this.preWarningFired,
      lastBreakDurationSec: this.lastBreakDurationSec,
      skipNext: this.skipNext,
    };
  }

  _tick() {
    if (this.paused) {
      this.onTick(this.getState());
      return;
    }

    if (this.phase === 'work') {
      const idleSec = Math.max(0, Math.floor(this.getIdleSeconds()));

      if (idleSec >= this.idleThresholdSec) {
        if (this.workElapsedSec > 0 && this.idleResetArmed) {
          this.workElapsedSec = 0;
          this.preWarningFired = false; // reset so a future warning can fire
          this.idleResetArmed = false;
          this.onIdleReset(this.getState());
        }
        this.onTick(this.getState());
        return;
      }

      this.idleResetArmed = true;
      this.workElapsedSec += 1;

      // Pre-warning fires once when we cross the threshold.
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
      if (this.breakElapsedSec >= this.breakDurationSec) {
        this._endBreak(true);
      } else {
        this.onTick(this.getState());
      }
    }
  }

  _startBreak() {
    this.phase = 'break';
    this.breakElapsedSec = 0;
    this.onBreakStart(this.getState());
  }

  _endBreak(completed) {
    this.lastBreakDurationSec = this.breakElapsedSec;
    this.phase = 'work';
    this.workElapsedSec = 0;
    this.breakElapsedSec = 0;
    this.idleResetArmed = true;
    this.preWarningFired = false;
    this.onBreakEnd(this.getState(), completed);
  }
}

module.exports = { Timer };
