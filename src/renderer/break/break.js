// break.js — break overlay countdown & breathing cue.

(() => {
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') || 'fullscreen';
  const totalSec = Math.max(5, parseInt(params.get('breakDurationSec') || '20', 10));
  const allowSkip = params.get('allowSkip') === 'true';
  const soundEnabled = params.get('soundEnabled') !== 'false';

  document.body.classList.remove('mode-fullscreen');
  document.body.classList.add(`mode-${mode}`);
  const isLongBreak = params.get('isLongBreak') === 'true';
  if (isLongBreak) document.body.classList.add('is-long');
  const $label = document.querySelector('.label');
  const $guideEl = document.getElementById('guide');
  if (isLongBreak) {
    if ($label) $label.textContent = '深呼吸時刻 · 長休息';
    if ($guideEl) $guideEl.textContent = '站起來伸個懶腰，或眺望遠方 3 分鐘';
  }

  const $count = document.getElementById('count');
  const $ring = document.querySelector('.ring-progress');
  const $breath = document.getElementById('breath');
  const $skip = document.getElementById('skip');
  const $chime = document.getElementById('chime');

  if (allowSkip && $skip) $skip.hidden = false;

  const RING_CIRC = 2 * Math.PI * 108;
  $ring.style.strokeDasharray = String(RING_CIRC);
  $ring.style.strokeDashoffset = '0';

  let remaining = totalSec;
  const started = Date.now();

  function render() {
    $count.textContent = String(Math.max(0, remaining));
    const progress = Math.min(1, (totalSec - remaining) / totalSec);
    $ring.style.strokeDashoffset = String(RING_CIRC * progress);
    // breathing cue alternates every 4s
    const beat = Math.floor((Date.now() - started) / 2000) % 2;
    $breath.textContent = beat === 0 ? '吸 氣' : '吐 氣';
  }

  render();
  if (soundEnabled && $chime) {
    $chime.play().catch(() => {/* missing asset or blocked autoplay — ignore */});
  }

  const iv = setInterval(() => {
    remaining -= 1;
    render();
    if (remaining <= 0) {
      clearInterval(iv);
    }
  }, 1000);

  $skip?.addEventListener('click', () => {
    if (window.eyerest?.skipBreak) window.eyerest.skipBreak();
  });

  // Allow Esc to skip when permitted (renders are focusable).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && allowSkip && window.eyerest?.skipBreak) {
      window.eyerest.skipBreak();
    }
  });
})();
