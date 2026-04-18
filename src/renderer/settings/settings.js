// settings.js — renderer for the settings window.

(() => {
  const $ = (id) => document.getElementById(id);

  const workMin = $('workMin');
  const breakSec = $('breakSec');
  const idleMin = $('idleMin');
  const workOut = $('workOut');
  const breakOut = $('breakOut');
  const idleOut = $('idleOut');
  const modeSeg = $('mode');
  const soundEnabled = $('soundEnabled');
  const allowSkip = $('allowSkip');
  const autoLaunch = $('autoLaunch');
  const breakNowBtn = $('breakNow');
  const pauseToggleBtn = $('pauseToggle');
  const status = $('status');

  function formatSec(sec) {
    if (sec < 60) return `${sec} 秒`;
    if (sec % 60 === 0) return `${sec / 60} 分`;
    return `${Math.floor(sec / 60)} 分 ${sec % 60} 秒`;
  }

  function paintMode(val) {
    modeSeg.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-checked', b.dataset.value === val ? 'true' : 'false');
    });
  }

  async function loadSettings() {
    const s = await window.eyerest.getSettings();
    workMin.value = Math.round(s.workDurationSec / 60);
    breakSec.value = s.breakDurationSec;
    idleMin.value = Math.round(s.idleThresholdSec / 60);
    workOut.textContent = `${workMin.value} 分`;
    breakOut.textContent = formatSec(Number(breakSec.value));
    idleOut.textContent = `${idleMin.value} 分`;
    paintMode(s.reminderMode);
    soundEnabled.checked = !!s.soundEnabled;
    allowSkip.checked = !!s.allowSkip;
    autoLaunch.checked = !!s.autoLaunch;
  }

  async function save(partial) {
    await window.eyerest.setSettings(partial);
  }

  async function refreshStatus() {
    const state = await window.eyerest.getTimerState();
    if (state.paused) {
      status.textContent = '已暫停';
      pauseToggleBtn.textContent = '繼續';
    } else if (state.phase === 'break') {
      const r = state.breakDurationSec - state.breakElapsedSec;
      status.textContent = `休息中 · 還剩 ${r} 秒`;
      pauseToggleBtn.textContent = '暫停';
    } else {
      const r = state.workDurationSec - state.workElapsedSec;
      const m = Math.floor(r / 60);
      const s = r % 60;
      status.textContent = `距下次休息 ${m}:${String(s).padStart(2, '0')}`;
      pauseToggleBtn.textContent = '暫停';
    }
  }

  workMin.addEventListener('input', () => {
    workOut.textContent = `${workMin.value} 分`;
  });
  workMin.addEventListener('change', () => save({ workDurationSec: Number(workMin.value) * 60 }));

  breakSec.addEventListener('input', () => {
    breakOut.textContent = formatSec(Number(breakSec.value));
  });
  breakSec.addEventListener('change', () => save({ breakDurationSec: Number(breakSec.value) }));

  idleMin.addEventListener('input', () => {
    idleOut.textContent = `${idleMin.value} 分`;
  });
  idleMin.addEventListener('change', () => save({ idleThresholdSec: Number(idleMin.value) * 60 }));

  modeSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-value]');
    if (!btn) return;
    paintMode(btn.dataset.value);
    save({ reminderMode: btn.dataset.value });
  });

  soundEnabled.addEventListener('change', () => save({ soundEnabled: soundEnabled.checked }));
  allowSkip.addEventListener('change', () => save({ allowSkip: allowSkip.checked }));
  autoLaunch.addEventListener('change', () => save({ autoLaunch: autoLaunch.checked }));

  breakNowBtn.addEventListener('click', () => window.eyerest.breakNow());
  pauseToggleBtn.addEventListener('click', async () => {
    await window.eyerest.pauseToggle();
    refreshStatus();
  });

  window.eyerest.onTick(() => refreshStatus());
  window.eyerest.onSettings(() => loadSettings());
  window.eyerest.onState(() => refreshStatus());

  loadSettings();
  refreshStatus();
  setInterval(refreshStatus, 2000);
})();
