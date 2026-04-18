// prewarn.js — small corner popup shown 1 min before a break.
//
// Buttons:
//   立刻休息  → window.eyerest.breakNow()          (skip the countdown, go into break now)
//   再 3 分鐘 → window.eyerest.postpone(3)         (push break 3 min forward)
//   Skip     → window.eyerest.skipNextFromPreWarn() (cancel this break, start a new work cycle)

(() => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const remainSec = Math.max(0, parseInt(params.get('remainSec') || '60', 10));

  let remaining = remainSec;
  const $cd = $('countdown');

  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function render() {
    if ($cd) $cd.textContent = fmt(Math.max(0, remaining));
  }

  render();
  const iv = setInterval(() => {
    remaining -= 1;
    render();
    if (remaining <= 0) {
      clearInterval(iv);
      // Main process will close this window when the break starts.
    }
  }, 1000);

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
