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

function makeTimer({ workSec = 10, breakSec = 3, idleSec = 5 } = {}) {
  let idle = 0;
  const events = [];
  const settings = {
    workDurationSec: workSec,
    breakDurationSec: breakSec,
    idleThresholdSec: idleSec,
  };
  const timer = new Timer({
    getSettings: () => settings,
    getIdleSeconds: () => idle,
    onTick: (s) => events.push({ type: 'tick', phase: s.phase, work: s.workElapsedSec, brk: s.breakElapsedSec }),
    onBreakStart: () => events.push({ type: 'break-start' }),
    onBreakEnd: (_s, completed) => events.push({ type: 'break-end', completed }),
    onIdleReset: () => events.push({ type: 'idle-reset' }),
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
  step(3); // should trigger break start on 3rd tick
  assertEq('phase after work duration', timer.getState().phase, 'break');
  step(2); // break should complete
  assertEq('phase after break duration', timer.getState().phase, 'work');
  assertEq('completed break event fired', events.some(e => e.type === 'break-end' && e.completed === true), true);
}

// ---------- Test 2: idle reset during work ----------
console.log('Test 2: idle reset during work');
{
  const { timer, step, setIdle, events } = makeTimer({ workSec: 10, breakSec: 2, idleSec: 5 });
  step(3); // 3 seconds of work
  assertEq('work elapsed after 3 active ticks', timer.getState().workElapsedSec, 3);
  setIdle(6); // user has been idle 6 seconds — above threshold (5)
  step(1);
  assertEq('work elapsed resets to 0', timer.getState().workElapsedSec, 0);
  assertEq('idle-reset event fired', events.some(e => e.type === 'idle-reset'), true);

  // Further idle ticks do not accumulate work.
  step(5);
  assertEq('still 0 while idle', timer.getState().workElapsedSec, 0);

  // User returns — should start counting from 0.
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
  step(5); // these ticks should do nothing
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
  step(60); // 1 min in, 9 min remaining
  timer.snooze(5); // want 5 min remaining
  const remain = timer.getState().workDurationSec - timer.getState().workElapsedSec;
  assertEq('~5 min remaining after snooze', remain, 300);
}

// ---------- Test 8: endBreakEarly marks incomplete ----------
console.log('Test 8: endBreakEarly counts as incomplete');
{
  const { timer, step, events } = makeTimer({ workSec: 2, breakSec: 10 });
  step(2); // enter break
  timer.endBreakEarly();
  const e = events.filter(x => x.type === 'break-end').pop();
  assertEq('break-end fired', !!e, true);
  assertEq('break-end marked incomplete', e.completed, false);
}

// ---------- Summary ----------
console.log('');
if (failures === 0) {
  console.log('All timer tests passed ✓');
  process.exit(0);
} else {
  console.log(`${failures} test(s) FAILED`);
  process.exit(1);
}
