const assert = require('assert/strict');
const { normalizeTimeZone, dateKey, shiftDate, aggregateStats } = require('../src/shared/stats-time');
const early = new Date('2026-10-17T17:30:00Z');
assert.equal(dateKey(early, 'Asia/Taipei'), '2026-10-18');
assert.equal(dateKey(early, 'UTC'), '2026-10-17');
assert.equal(dateKey(new Date('2026-01-01T00:30:00Z'), 'America/Los_Angeles'), '2025-12-31');
assert.equal(dateKey(new Date('2026-03-08T09:30:00Z'), 'America/Los_Angeles'), '2026-03-08');
assert.equal(dateKey(new Date('2026-03-08T10:30:00Z'), 'America/Los_Angeles'), '2026-03-08');
assert.equal(dateKey(early, 'system'), dateKey(early, Intl.DateTimeFormat().resolvedOptions().timeZone));
assert.equal(shiftDate('2026-01-01', -1), '2025-12-31');
assert.equal(shiftDate('2024-03-01', -1), '2024-02-29');
assert.equal(shiftDate('2026-03-09', -1), '2026-03-08');
assert.equal(normalizeTimeZone('UTC'), 'UTC');
assert.throws(() => normalizeTimeZone('Mars/Space'));
assert.throws(() => normalizeTimeZone(undefined));
const legacy = { '2026-10-17': { cycles: 2, totalRestSec: 40 } };
const events = [{ completedAt: early.toISOString(), restSec: 20 }];
assert.deepEqual(aggregateStats(legacy, events, 'Asia/Taipei'), {
  '2026-10-17': { cycles: 2, totalRestSec: 40 }, '2026-10-18': { cycles: 1, totalRestSec: 20 },
});
assert.deepEqual(aggregateStats(legacy, events, 'UTC'), { '2026-10-17': { cycles: 3, totalRestSec: 60 } });
assert.equal(legacy['2026-10-17'].cycles, 2, 'regrouping must not mutate legacy data');
console.log('Time zone checks passed: Taipei/UTC, year boundary, DST, system zone, leap day, validation and legacy preservation.');
