// Minimal test for the Timer's state machine (no external frameworks).
// Run with:  node test/timer.test.js
//
// Strategy: instead of waiting real seconds, we swap setInterval for a manual
// ticker — each call to step() triggers one "tick" as if 1 second passed.

const { Timer } = require('../src/main/timer');

let failures = 0;
function assertEq(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}`);
    console.log(`       expected ${JSON.stringify(expected)}`);
    console.log(`       got      ${JSON.stringify(actual)}`);
  }
}

function makeTimer({
  workSec = 10,
  breakSec = 3,
  idleSec = 5,
  idleResetDelaySec = 1,
  now = Date.now,
  preWarningEnabled = true,
  preWarningSec = 0,
  longBreakEnabled = false,
  longBreakDurationSec = 7,
  longBreakEvery = 3,
  forceLongBreakAfterSkip = false,
} = {}) {
  let idle = 0;
  const events = [];
  const settings = {
    workDurationSec: workSec,
    breakDurationSec: breakSec,
    idleThresholdSec: idleSec,
    idleResetDelaySec,
    preWarningEnabled,
    preWarningSec,
    longBreakEnabled,
    longBreakDurationSec,
    longBreakEvery,
    forceLongBreakAfterSkip,
  };
  const timer = new Timer({
    now,
    getSettings: () => settings,
    getIdleSeconds: () => idle,
    onTick: (s) => events.push({ type: 'tick', phase: s.phase, work: s.workElapsedSec, brk: s.breakElapsedSec }),
    onBreakStart: (s) => events.push({ type: 'break-start', isLongBreak: s.isLongBreak, breakDurationSec: s.breakDurationSec }),
    onBreakEnd: (_s, completed) => events.push({ type: 'break-end', completed }),
    onIdleReset: () => events.push({ type: 'idle-reset' }),
    onPreWarning: (s) => events.push({ type: 'pre-warning', work: s.workElapsedSec }),
  });
  // Replace auto-interval with manual step.
  timer.start = () => {};
  timer.stop = () => {};
  return {
    timer,
    step: (n = 1) => { for (let i = 0; i < n; i += 1) timer._tick(); },
    setIdle: (v) => { idle = v; },
    events,
  };
}

// ---------- Test 1: basic work → break → end cycle ----------
console.log('Test 1: basic cycle (work → break → end)');
{
  const { timer, step, events } = makeTimer({ workSec: 3, breakSec: 2 });
  step(3);
  assertEq('phase after work duration', timer.getState().phase, 'break');
  step(2);
  assertEq('phase after break duration', timer.getState().phase, 'work');
  assertEq('completed break event fired', events.some(e => e.type === 'break-end' && e.completed === true), true);
}

// ---------- Test 2: idle reset during work ----------
console.log('Test 2: idle reset during work');
{
  const { timer, step, setIdle, events } = makeTimer({ workSec: 10, breakSec: 2, idleSec: 5 });
  step(3);
  assertEq('work elapsed after 3 active ticks', timer.getState().workElapsedSec, 3);
  setIdle(6);
  step(1);
  assertEq('work elapsed resets to 0', timer.getState().workElapsedSec, 0);
  assertEq('idle-reset event fired', events.some(e => e.type === 'idle-reset'), true);

  step(5);
  assertEq('still 0 while idle', timer.getState().workElapsedSec, 0);

  setIdle(0);
  step(2);
  assertEq('work counts up after returning', timer.getState().workElapsedSec, 2);
}

// ---------- Test 3: idle-reset only fires once per idle stretch ----------
console.log('Test 3: idle-reset is armed/disarmed correctly');
{
  const { timer, step, setIdle, events } = makeTimer({ workSec: 10, idleSec: 5 });
  step(3);
  setIdle(10);
  step(5);
  const resets = events.filter(e => e.type === 'idle-reset').length;
  assertEq('only one idle-reset for one stretch', resets, 1);

  setIdle(0);
  step(3);
  setIdle(10);
  step(1);
  const resets2 = events.filter(e => e.type === 'idle-reset').length;
  assertEq('second idle stretch fires reset again', resets2, 2);
}

// ---------- Test 4: pause halts progress ----------
console.log('Test 4: pause / resume');
{
  const { timer, step } = makeTimer({ workSec: 10 });
  step(2);
  timer.togglePause();
  step(5);
  assertEq('work elapsed unchanged while paused', timer.getState().workElapsedSec, 2);
  timer.togglePause();
  step(3);
  assertEq('work resumes after unpause', timer.getState().workElapsedSec, 5);
}

// ---------- Test 5: forceBreak ----------
console.log('Test 5: forceBreak skips to break immediately');
{
  const { timer, step } = makeTimer({ workSec: 100, breakSec: 2 });
  step(5);
  timer.forceBreak();
  assertEq('phase is break after forceBreak', timer.getState().phase, 'break');
  step(2);
  assertEq('returns to work after break', timer.getState().phase, 'work');
}

// ---------- Test 6: skipNextBreak ----------
console.log('Test 6: skipNextBreak does not enter break');
{
  const { timer, step } = makeTimer({ workSec: 3 });
  timer.skipNextBreak();
  step(3);
  assertEq('still in work phase after skip', timer.getState().phase, 'work');
  assertEq('work elapsed resets after skip', timer.getState().workElapsedSec, 0);
}

// ---------- Test 7: snooze pushes remaining forward ----------
console.log('Test 7: snooze');
{
  const { timer, step } = makeTimer({ workSec: 600 });
  step(60);
  timer.snooze(5);
  const remain = timer.getState().workDurationSec - timer.getState().workElapsedSec;
  assertEq('~5 min remaining after snooze', remain, 300);
}

// ---------- Test 8: endBreakEarly marks incomplete ----------
console.log('Test 8: endBreakEarly counts as incomplete');
{
  const { timer, step, events } = makeTimer({ workSec: 2, breakSec: 10 });
  step(2);
  timer.endBreakEarly();
  const e = events.filter(x => x.type === 'break-end').pop();
  assertEq('break-end fired', !!e, true);
  assertEq('break-end marked incomplete', e.completed, false);
}

// ---------- Test 9: pre-warning fires once at the right moment ----------
console.log('Test 9: pre-warning fires exactly once per cycle');
{
  const { timer, step, events } = makeTimer({ workSec: 10, preWarningSec: 3 });
  step(6); // work=6, threshold = 10 - 3 = 7 → not yet
  assertEq('pre-warning not fired yet at 6s', events.filter(e => e.type === 'pre-warning').length, 0);
  step(1); // work=7 → threshold crossed
  assertEq('pre-warning fires at threshold', events.filter(e => e.type === 'pre-warning').length, 1);
  step(2); // work=9 (still before break)
  assertEq('pre-warning does not repeat', events.filter(e => e.type === 'pre-warning').length, 1);
}

// ---------- Test 10: pre-warning does not fire if disabled ----------
console.log('Test 10: pre-warning respects preWarningEnabled=false');
{
  const { timer, step, events } = makeTimer({ workSec: 5, preWarningEnabled: false, preWarningSec: 2 });
  step(5);
  assertEq('no pre-warning when disabled', events.filter(e => e.type === 'pre-warning').length, 0);
}

// ---------- Test 11: postpone re-arms pre-warning ----------
console.log('Test 11: postpone resets pre-warning for new schedule');
{
  const { timer, step, events } = makeTimer({ workSec: 60, preWarningSec: 5 });
  step(56); // cross threshold (60-5=55)
  assertEq('first pre-warning fired', events.filter(e => e.type === 'pre-warning').length, 1);
  timer.postpone(1); // 60 seconds remaining → elapsed = 0
  assertEq('postpone(1) leaves 60s remaining',
    timer.getState().workDurationSec - timer.getState().workElapsedSec, 60);
  // Advance past the new threshold (need to cross 60-5=55 again).
  step(55);
  assertEq('pre-warning fires again after postpone', events.filter(e => e.type === 'pre-warning').length, 2);
}

// ---------- Test 12: postpone(N) leaves exactly N*60 seconds remaining ----------
console.log('Test 12: postpone(N) math');
{
  const { timer, step } = makeTimer({ workSec: 20 * 60 });
  step(10 * 60); // 10 min in
  timer.postpone(3); // want 3 min remaining
  const remain = timer.getState().workDurationSec - timer.getState().workElapsedSec;
  assertEq('3 min remaining after postpone(3)', remain, 180);
}

// ---------- Test 13: idle-reset re-arms pre-warning ----------
console.log('Test 13: idle-reset re-arms pre-warning');
{
  const { timer, step, setIdle, events } = makeTimer({
    workSec: 10, idleSec: 5, preWarningSec: 3,
  });
  step(7); // fires pre-warning (threshold = 10-3 = 7)
  assertEq('pre-warning fired', events.filter(e => e.type === 'pre-warning').length, 1);
  setIdle(6);
  step(1); // idle reset → workElapsed = 0, preWarningFired=false
  assertEq('work reset by idle', timer.getState().workElapsedSec, 0);
  setIdle(0);
  step(7); // cross threshold again
  assertEq('pre-warning fires again after idle reset',
    events.filter(e => e.type === 'pre-warning').length, 2);
}

// ---------- Test 14: pre-warning re-arms after break ends ----------
console.log('Test 14: new cycle after break gets pre-warning again');
{
  const { timer, step, events } = makeTimer({ workSec: 5, breakSec: 2, preWarningSec: 2 });
  step(5); // fires pre-warning at work=3, then break at work=5
  step(2); // break complete → back to work
  assertEq('second cycle starts at 0', timer.getState().workElapsedSec, 0);
  step(3); // work=3, pre-warning again
  assertEq('pre-warning fires in each cycle',
    events.filter(e => e.type === 'pre-warning').length, 2);
}

// ---------- Test 15: every 3rd break is a long break ----------
console.log('Test 15: every Nth break is long (Pomodoro pattern)');
{
  const { timer, step, events } = makeTimer({
    workSec: 2, breakSec: 2, longBreakEnabled: true, longBreakDurationSec: 5, longBreakEvery: 3,
  });
  // Cycle 1
  step(2); assertEq('break1 is normal', events.filter(e => e.type === 'break-start').pop().isLongBreak, false);
  step(2); // end break1
  // Cycle 2
  step(2); assertEq('break2 is normal', events.filter(e => e.type === 'break-start').pop().isLongBreak, false);
  step(2);
  // Cycle 3 -> long
  step(2);
  const b3 = events.filter(e => e.type === 'break-start').pop();
  assertEq('break3 is long',            b3.isLongBreak, true);
  assertEq('break3 uses longBreak dur', b3.breakDurationSec, 5);
  step(5);
  // Cycle 4 -> back to normal
  step(2);
  assertEq('break4 is normal again', events.filter(e => e.type === 'break-start').pop().isLongBreak, false);
}

// ---------- Test 16: skip-next sets penalty flag → next break is long ----------
console.log('Test 16: force long break after skip');
{
  const { timer, step, events } = makeTimer({
    workSec: 2, breakSec: 2,
    longBreakEnabled: true, longBreakDurationSec: 5, longBreakEvery: 100,
    forceLongBreakAfterSkip: true,
  });
  timer.skipNextBreak();
  step(2); // crosses threshold and skips (no break)
  assertEq('no break started yet', events.filter(e => e.type === 'break-start').length, 0);
  assertEq('nextBreakIsLong flag set', timer.getState().nextBreakIsLong, true);
  step(2); // next cycle enters break
  const b = events.filter(e => e.type === 'break-start').pop();
  assertEq('break after skip is long', b.isLongBreak, true);
  assertEq('break after skip uses long dur', b.breakDurationSec, 5);
  // Flag is consumed
  assertEq('penalty flag cleared after consumption', timer.getState().nextBreakIsLong, false);
}

// ---------- Test 17: skip penalty disabled → next break stays normal ----------
console.log('Test 17: forceLongBreakAfterSkip=false → no penalty');
{
  const { timer, step, events } = makeTimer({
    workSec: 2, breakSec: 2,
    longBreakEnabled: true, longBreakDurationSec: 5, longBreakEvery: 100,
    forceLongBreakAfterSkip: false,
  });
  timer.skipNextBreak();
  step(2);
  step(2);
  const b = events.filter(e => e.type === 'break-start').pop();
  assertEq('break after skip remains normal', b.isLongBreak, false);
  assertEq('break after skip uses normal dur', b.breakDurationSec, 2);
}

// ---------- Test 18: pauseFor auto-resumes after timeout ----------
console.log('Test 18: pauseFor auto-resumes');
{
  const { timer, step } = makeTimer({ workSec: 100 });
  step(3);
  // Use fake timers for reliable auto-resume test.
  const originalSetTimeout = global.setTimeout;
  let scheduledCb = null;
  global.setTimeout = (cb, ms) => { scheduledCb = cb; return 42; };
  try {
    timer.pauseFor(15);
    assertEq('paused after pauseFor', timer.getState().paused, true);
    assertEq('pausedUntilMs is set', typeof timer.getState().pausedUntilMs, 'number');
    step(5); // should not advance because paused
    assertEq('work not advanced while paused', timer.getState().workElapsedSec, 3);
    // Fire the scheduled auto-resume
    scheduledCb && scheduledCb();
    assertEq('auto-resumed after timeout fires', timer.getState().paused, false);
    step(2);
    assertEq('work resumes after auto-unpause', timer.getState().workElapsedSec, 5);
  } finally {
    global.setTimeout = originalSetTimeout;
  }
}

// ---------- Test 19: togglePause cancels pending timed-pause ----------
console.log('Test 19: togglePause cancels pauseFor timeout');
{
  const { timer } = makeTimer({ workSec: 100 });
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  let cleared = false;
  global.setTimeout = () => 99;
  global.clearTimeout = () => { cleared = true; };
  try {
    timer.pauseFor(30);
    timer.togglePause(); // should unpause + clear
    assertEq('clearTimeout called',         cleared, true);
    assertEq('pausedUntilMs cleared',       timer.getState().pausedUntilMs, null);
    assertEq('paused is false after unpause', timer.getState().paused, false);
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }
}

console.log('Test 20: game pause preserves progress, suppresses warnings and idle resets');
{
  const { timer, step, setIdle, events } = makeTimer({ workSec: 10, preWarningSec: 3 });
  step(6);
  timer.setGamePause('game.exe');
  setIdle(100);
  step(20);
  assertEq('game preserves elapsed time despite idle', timer.workElapsedSec, 6);
  assertEq('no warning while gaming', events.some(e => e.type === 'pre-warning'), false);
  timer.setGamePause(''); step();
  assertEq('resume preserves controller-only progress', timer.workElapsedSec, 7);
  setIdle(0); step(); setIdle(100); step();
  assertEq('idle detection returns after input', timer.workElapsedSec, 0);
}
console.log('Test 21: manual and game pauses are independent');
{
  const { timer, step } = makeTimer();
  step(2); timer.togglePause(); timer.setGamePause('game.exe');
  timer.setGamePause(''); step(3);
  assertEq('leaving game keeps manual pause', timer.paused, true);
  assertEq('manual pause preserves time', timer.workElapsedSec, 2);
  timer.setGamePause('game.exe'); timer.togglePause(); step(3);
  assertEq('game still pauses after manual resume', timer.workElapsedSec, 2);
  timer.setGamePause(''); step();
  assertEq('resumes when both released', timer.workElapsedSec, 3);
}
console.log('Test 22: ongoing breaks continue during gaming');
{
  const { timer, step } = makeTimer({ workSec: 2, breakSec: 2 });
  step(2); timer.setGamePause('game.exe'); step(2);
  assertEq('break finishes', timer.phase, 'work');
  step(5);
  assertEq('next work period stays paused', timer.workElapsedSec, 0);
}
const { normalizeGamePath } = require('../src/main/game-monitor');
assertEq('case insensitive full paths', normalizeGamePath('C:/Games/Test.EXE'), 'c:\\games\\test.exe');
assertEq('relative paths rejected', normalizeGamePath('game.exe'), '');
assertEq('non executables rejected', normalizeGamePath('C:/game.txt'), '');

console.log('Test 23: mini timer adds time and resets extension after a cycle');
{
  const { timer, step } = makeTimer({ workSec: 300, breakSec: 2 });
  step(10);
  timer.extendWork(1);
  assertEq('one minute adds to current remaining', timer.getState().workDurationSec - timer.workElapsedSec, 350);
  timer.extendWork(3);
  assertEq('three minutes accumulate', timer.getState().workDurationSec - timer.workElapsedSec, 530);
  timer.extendWork(2);
  assertEq('unsupported duration ignored', timer.getState().workDurationSec, 540);
  step(529);
  assertEq('no early break at original deadline', timer.phase, 'work');
  step();
  assertEq('break begins at extended deadline', timer.phase, 'break');
  timer.extendWork(1);
  step(2);
  assertEq('next cycle uses configured duration', timer.getState().workDurationSec, 300);
}
console.log('Test 24: idle clears extension and extension re-arms warning');
{
  const { timer, step, setIdle, events } = makeTimer({ workSec: 120, preWarningSec: 10 });
  step(110);
  timer.extendWork(1);
  step(59);
  assertEq('no premature repeated warning', events.filter(e => e.type === 'pre-warning').length, 1);
  step();
  assertEq('warning follows extended deadline', events.filter(e => e.type === 'pre-warning').length, 2);
  setIdle(10); step();
  assertEq('idle restores base duration', timer.getState().workDurationSec, 120);
  assertEq('idle clears elapsed time', timer.workElapsedSec, 0);
}
console.log('Test 25: extension preserves pauses and immediate break');
{
  const { timer, step } = makeTimer({ workSec: 120 });
  timer.togglePause(); timer.extendWork(3); step(2);
  assertEq('extension preserves manual pause', timer.paused, true);
  assertEq('extended timer stays frozen', timer.workElapsedSec, 0);
  timer.togglePause(); timer.setGamePause('game.exe'); timer.extendWork(1); step(2);
  assertEq('extension preserves game pause', timer.workElapsedSec, 0);
  timer.forceBreak();
  assertEq('immediate break works while gaming', timer.phase, 'break');
}

console.log('Test 26: separate idle pause/reset thresholds and exact boundaries');
{
  const { timer, step, setIdle, events } = makeTimer({ workSec: 1200, idleSec: 300, idleResetDelaySec: 300 });
  step(400); timer.extendWork(1);
  setIdle(299); step();
  assertEq('before pause threshold still running', timer.workElapsedSec, 401);
  setIdle(300); step(5);
  assertEq('pause threshold preserves elapsed', timer.workElapsedSec, 401);
  assertEq('pause preserves extension', timer.getState().workDurationSec, 1260);
  assertEq('idle state is exposed separately', [timer.getState().idlePaused, timer.paused], [true, false]);
  setIdle(599); step();
  assertEq('before reset threshold keeps progress', timer.workElapsedSec, 401);
  setIdle(600); step(5);
  assertEq('reset restores configured duration', [timer.workElapsedSec, timer.getState().workDurationSec], [0, 1200]);
  assertEq('reset waits for input', [timer.getState().idlePaused, timer.getState().idleReset], [true, true]);
  assertEq('only one reset per absence', events.filter(e => e.type === 'idle-reset').length, 1);
  setIdle(0); step();
  assertEq('return resumes new cycle', [timer.workElapsedSec, timer.getState().idlePaused, timer.getState().idleReset], [1, false, false]);
}
console.log('Test 27: short idle preserves progress and re-arms warning on return');
{
  const { timer, step, setIdle, events } = makeTimer({ workSec: 20, idleSec: 5, idleResetDelaySec: 10, preWarningSec: 5 });
  step(15); setIdle(5); step(10);
  assertEq('no break while idle paused', timer.phase, 'work');
  assertEq('short idle does not reset', timer.workElapsedSec, 15);
  setIdle(0); step();
  assertEq('short idle resumes preserved progress', timer.workElapsedSec, 16);
  assertEq('warning is shown again after returning', events.filter(e => e.type === 'pre-warning').length, 2);
  assertEq('no reset during short idle', events.some(e => e.type === 'idle-reset'), false);
}
console.log('Test 28: manual and idle pauses stay independent');
{
  const { timer, step, setIdle } = makeTimer({ workSec: 100, idleSec: 5, idleResetDelaySec: 10 });
  step(10); timer.togglePause(); setIdle(5); step();
  timer.togglePause(); step();
  assertEq('manual resume cannot bypass idle pause', timer.workElapsedSec, 10);
  timer.togglePause(); setIdle(0); step();
  assertEq('input does not release manual pause', [timer.paused, timer.workElapsedSec, timer.getState().idlePaused], [true, 10, false]);
  setIdle(15); step(); setIdle(0); step();
  assertEq('long idle resets while preserving manual pause', [timer.paused, timer.workElapsedSec], [true, 0]);
}
console.log('Test 29: sleep duration is counted even after fresh input on wake');
{
  let now = 0;
  const { timer, step, setIdle, events } = makeTimer({ workSec: 1200, idleSec: 300, idleResetDelaySec: 300, now: () => now });
  step(100); setIdle(200); timer.suspend();
  now = 400000; setIdle(0); step(10);
  assertEq('ticks cannot advance during sleep', timer.workElapsedSec, 100);
  timer.resume(); timer.resume();
  assertEq('pre-sleep idle plus sleep reaches reset threshold', timer.workElapsedSec, 0);
  assertEq('duplicate resume does not reset twice', events.filter(e => e.type === 'idle-reset').length, 1);
  step(); assertEq('wake input starts new cycle', timer.workElapsedSec, 1);
}
console.log('Test 30: short sleep and game pause preserve progress');
{
  let now = 0;
  const { timer, step } = makeTimer({ workSec: 1200, idleSec: 300, idleResetDelaySec: 300, now: () => now });
  step(100); timer.suspend(); now += 300000; timer.resume(); step();
  assertEq('short sleep preserves progress', timer.workElapsedSec, 101);
  timer.setGamePause('game.exe'); timer.suspend(); now += 900000; timer.resume(); step();
  assertEq('sleep does not override game pause', timer.workElapsedSec, 101);
}

// ---------- Summary ----------
console.log('');
if (failures === 0) {
  console.log('All timer tests passed');
  process.exit(0);
} else {
  console.log(`${failures} test(s) FAILED`);
  process.exit(1);
}
