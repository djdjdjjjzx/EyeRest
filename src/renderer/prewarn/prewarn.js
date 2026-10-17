// prewarn.js — small corner popup shown 1 min before a break.
//
// Buttons:
//   立刻休息  → window.eyerest.breakNow()          (skip the countdown, go into break now)
//   再 3 分鐘 → window.eyerest.postpone(3)         (push break 3 min forward)
//   Skip     → window.eyerest.skipNextFromPreWarn() (cancel this break, start a new work cycle)

(() => {
  const $ = (id) => document.getElementById(id);
  const $cd = $('countdown');

  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function render(state) {
    if (state.phase !== 'work' || state.paused || state.gamePauseName || state.idlePaused || state.suspended) {
      window.eyerest.closePreWarn();
      return;
    }
    if ($cd) $cd.textContent = fmt(Math.max(0, state.workDurationSec - state.workElapsedSec));
  }

  window.eyerest.onTick(render);
  window.eyerest.onState(render);
  window.eyerest.onIdleReset(() => window.eyerest.closePreWarn());
  window.eyerest.getTimerState().then(render).catch(console.error);

  const onClick = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', fn);
  };

  onClick('breakNow', () => window.eyerest.breakNow());
  onClick('plus3',    () => window.eyerest.postpone(3));
  onClick('skip',     () => window.eyerest.skipNextFromPreWarn());
  onClick('close',    () => window.eyerest.closePreWarn());

  if (window.eyerest && window.eyerest.onBreakStart) {
    window.eyerest.onBreakStart(() => window.eyerest.closePreWarn());
  }
})();
