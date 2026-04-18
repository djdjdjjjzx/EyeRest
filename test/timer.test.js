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
  preWarningEnabled = true,
  preWarningSec = 0, // default off unless explicitly set
} = {}) {
  let idle = 0;
  const events = [];
  const settings = {
    workDurationSec: workSec,
    breakDurationSec: breakSec,
    idleThresholdSec: idleSec,
    preWarningEnabled,
    preWarningSec,
  };
  const timer = new Timer({
    getSettings: () => settings,
    getIdleSeconds: () => idle,
    onTick: (s) => events.push({ type: 'tick', phase: s.phase, work: s.workElapsedSec, brk: s.breakElapsedSec }),
    onBreakStart: () => events.push({ type: 'break-start' }),
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

// ---------- Summary ----------
console.log('');
if (failures === 0) {
  console.log('All timer tests passed');
  process.exit(0);
} else {
  console.log(`${failures} test(s) FAILED`);
  process.exit(1);
}
