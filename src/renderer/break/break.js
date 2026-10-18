// break.js — break overlay countdown & breathing cue.

(() => {
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') || 'fullscreen';
  const totalSec = Math.max(5, parseInt(params.get('breakDurationSec') || '20', 10));
  const allowSkip = params.get('allowSkip') === 'true';

  document.body.classList.remove('mode-fullscreen');
  document.body.classList.add(`mode-${mode}`);
  const isLongBreak = params.get('isLongBreak') === 'true';
  if (isLongBreak) document.body.classList.add('is-long');
  const $label = document.querySelector('.label');
  const $guideEl = document.getElementById('guide');
  if (isLongBreak) {
    if ($label) $label.textContent = '好好放鬆一下 · 長休息';
    document.getElementById('heading').textContent = '起身，換一個風景。';
    document.getElementById('eyebrow').textContent = 'A LITTLE ROOM TO BREATHE';
    if ($guideEl) $guideEl.textContent = '伸個懶腰、走一走，讓身體也休息一下。';
  }
  if (mode === 'notification') document.getElementById('count-unit').textContent = '秒';

  const $count = document.getElementById('count');
  const $progress = document.getElementById('progress');
  const $breath = document.getElementById('breath');
  const $skip = document.getElementById('skip');

  if (allowSkip && $skip) $skip.hidden = false;

  let remaining = totalSec;
  const started = Date.now();

  function render() {
    $count.textContent = String(Math.max(0, remaining));
    const progress = Math.min(1, (totalSec - remaining) / totalSec);
    $progress.style.transform = `scaleX(${1 - progress})`;
    // breathing cue alternates every 4s
    const beat = Math.floor((Date.now() - started) / 2000) % 2;
    $breath.textContent = beat === 0 ? '吸 氣' : '吐 氣';
  }

  render();

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
