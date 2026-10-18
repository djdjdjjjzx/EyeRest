// Shared by Node and renderer: calendar dates in the selected IANA time zone.
(function (root) {
  function normalizeTimeZone(zone) {
    if (zone === 'system') return zone;
    if (typeof zone !== 'string' || !zone.trim()) throw new Error('請選擇有效的時區');
    return new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone;
  }
  function dateKey(date, zone = 'system') {
    const parts = new Intl.DateTimeFormat('en-US', {
      ...(zone === 'system' ? {} : { timeZone: zone }),
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const get = type => parts.find(p => p.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function shiftDate(key, days) {
    const date = new Date(`${key}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  function aggregateStats(legacy, events, zone) {
    const stats = Object.fromEntries(Object.entries(legacy).map(([key, value]) => [key, { ...value }]));
    for (const event of events) {
      const key = dateKey(new Date(event.completedAt), zone);
      const day = stats[key] || (stats[key] = { cycles: 0, totalRestSec: 0 });
      day.cycles += 1;
      day.totalRestSec += event.restSec;
    }
    return stats;
  }
  const api = { normalizeTimeZone, dateKey, shiftDate, aggregateStats };
  if (typeof module !== 'undefined') module.exports = api;
  else root.statsTime = api;
})(globalThis);
