// timer.js — core 20-20-20 state machine with idle-aware reset.
//
// Phases: 'work' | 'break' | 'paused'
//
// Work phase:
//   * Each tick (1s) we read powerMonitor.getSystemIdleTime() (in seconds).
//   * If idleSec >= idleThreshold while in work → reset workElapsed to 0.
//     (User walked away → eyes already rested → restart the work cycle.)
//   * If user comes back (idle drops), we just continue from 0.
//   * When workElapsed >= workDuration → enter break phase.
//
// Break phase:
//   * Counts down breakDurationSec and then ends.
//   * User can skip early (counts as incomplete) or wait full duration (completes).
//
// Paused: timer halts. Resumes from current state.

class Timer {
  constructor({ getSettings, getIdleSeconds, onTick, onBreakStart, onBreakEnd, onIdleReset }) {
    this.getSettings = getSettings;
    this.getIdleSeconds = getIdleSeconds;
    this.onTick = onTick || (() => {});
    this.onBreakStart = onBreakStart || (() => {});
    this.onBreakEnd = onBreakEnd || (() => {});
    this.onIdleReset = onIdleReset || (() => {});

    const s = getSettings();
    this.workDurationSec = s.workDurationSec;
    this.breakDurationSec = s.breakDurationSec;
    this.idleThresholdSec = s.idleThresholdSec;

    this.phase = 'work';
    this.workElapsedSec = 0;
    this.breakElapsedSec = 0;
    this.paused = false;
    this.skipNext = false;
    this.idleResetArmed = true; // prevents repeated onIdleReset spam during a single idle stretch
    this.lastBreakDurationSec = 0;

    this._interval = null;
  }

  applySettings(s) {
    this.workDurationSec = s.workDurationSec;
    this.breakDurationSec = s.breakDurationSec;
    this.idleThresholdSec = s.idleThresholdSec;
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

  /** End an in-progress break early (counts as skipped). */
  endBreakEarly() {
    if (this.phase !== 'break') return;
    this._endBreak(false);
  }

  /** Snooze: postpone the next break by N minutes (only meaningful in work phase). */
  snooze(minutes = 5) {
    if (this.phase !== 'work') return;
    // Push workElapsed back so we have `minutes` more minutes until break.
    const wantRemain = minutes * 60;
    this.workElapsedSec = Math.max(0, this.workDurationSec - wantRemain);
  }

  /** Force a break immediately, regardless of elapsed work time. */
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
        // User has been away long enough — count this as a rest.
        if (this.workElapsedSec > 0 && this.idleResetArmed) {
          this.workElapsedSec = 0;
          this.idleResetArmed = false;
          this.onIdleReset(this.getState());
        }
        // Don't increment workElapsed while idle.
        this.onTick(this.getState());
        return;
      }

      // User is active again — re-arm idle reset for next idle stretch.
      this.idleResetArmed = true;

      this.workElapsedSec += 1;

      if (this.workElapsedSec >= this.workDurationSec) {
        if (this.skipNext) {
          this.skipNext = false;
          this.workElapsedSec = 0;
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
    this.onBreakEnd(this.getState(), completed);
  }
}

module.exports = { Timer };
