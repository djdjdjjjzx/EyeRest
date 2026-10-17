// settings.js — renderer for the settings window.
// The script tag lives at the end of <body>, so the DOM is ready by the time
// we run. We wrap everything in try/catch so a failure anywhere doesn't leave
// the page looking frozen.

(function main() {
  try {
    runInit();
  } catch (err) {
    console.error('[EyeRest settings] init threw:', err);
    const s = document.getElementById('status');
    if (s) s.textContent = '初始化錯誤: ' + (err && err.message ? err.message : String(err));
  }
})();

function runInit() {
  const $ = (id) => document.getElementById(id);

  const gameEnabled = $('gamePauseEnabled');
  const gameList = $('gameList');
  const addGame = $('addGame');
  const gameError = $('gameError');
  gameEnabled.disabled = addGame.disabled = !window.eyerest.gamePauseSupported;
  gameEnabled.addEventListener('change', () => save({ gamePauseEnabled: gameEnabled.checked }));
  addGame.addEventListener('click', async () => {
    try { await window.eyerest.pickGames(); await loadSettings(); }
    catch (err) { gameError.textContent = '無法加入遊戲：' + err.message; }
  });
  function paintGames(paths) {
    gameList.replaceChildren();
    for (const game of paths) {
      const row = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = game;
      const remove = document.createElement('button');
      remove.className = 'btn';
      remove.textContent = '移除';
      remove.addEventListener('click', async () => {
        const current = await window.eyerest.getSettings();
        await save({ gamePaths: current.gamePaths.filter(p => p !== game) });
        await loadSettings();
      });
      row.append(label, remove);
      gameList.append(row);
    }
  }
  const workMin           = $('workMin');
  const breakSec          = $('breakSec');
  const idleMin           = $('idleMin');
  const idleResetMin      = $('idleResetMin');
  const idleResetOut      = $('idleResetOut');
  const workOut           = $('workOut');
  const breakOut          = $('breakOut');
  const idleOut           = $('idleOut');
  const modeSeg           = $('mode');
  const soundEnabled      = $('soundEnabled');
  const allowSkip         = $('allowSkip');
  const autoLaunch        = $('autoLaunch');
  const miniTimerEnabled  = $('miniTimerEnabled');
  const miniTimerOpacity = $('miniTimerOpacity');
  const miniTimerOpacityOut = $('miniTimerOpacityOut');
  $('showMiniTimer').addEventListener('click', () => save({ miniTimerEnabled: true }));
  const preWarningEnabled = $('preWarningEnabled');
  const preWarnSec        = $('preWarnSec');
  const preWarnOut        = $('preWarnOut');
  const longBreakEnabled  = $('longBreakEnabled');
  const longEvery         = $('longEvery');
  const longEveryOut      = $('longEveryOut');
  const longDur           = $('longDur');
  const longDurOut        = $('longDurOut');
  const forceLongAfterSkip = $('forceLongAfterSkip');
  const breakNowBtn       = $('breakNow');
  const pauseToggleBtn    = $('pauseToggle');
  // Do NOT name this `status` — window.status is a legacy browser property
  // and in some Electron versions assignments to it get intercepted.
  const statusEl          = $('status');

  function text(el, t) { if (el) el.textContent = t; }

  function paintSliders() {
    document.querySelectorAll('input[type="range"]').forEach(input => {
      const progress = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
      input.style.setProperty('--progress', `${progress}%`);
    });
  }

  const navLinks = [...document.querySelectorAll('nav a')];
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (!visible.length) return;
    const id = visible[0].target.id === 'reminders' ? 'warnings' : visible[0].target.id;
    navLinks.forEach(link => {
      if (link.hash === `#${id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-5% 0px -45% 0px' });
  document.querySelectorAll('.card').forEach(card => observer.observe(card));

  function formatSec(sec) {
    const n = Number(sec) || 0;
    if (n < 60) return `${n} 秒`;
    if (n % 60 === 0) return `${n / 60} 分`;
    return `${Math.floor(n / 60)} 分 ${n % 60} 秒`;
  }

  function paintMode(val) {
    if (!modeSeg) return;
    modeSeg.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-checked', b.dataset.value === val ? 'true' : 'false');
    });
  }

  async function loadSettings() {
    try {
      const s = await window.eyerest.getSettings();
      miniTimerOpacity.value = s.miniTimerOpacity ?? 35;
      text(miniTimerOpacityOut, `${miniTimerOpacity.value}%`);
      gameEnabled.checked = !!s.gamePauseEnabled;
      paintGames(s.gamePaths || []);
      if (workMin)  workMin.value  = Math.round(s.workDurationSec / 60);
      if (breakSec) breakSec.value = s.breakDurationSec;
      if (idleMin)  idleMin.value  = Math.round(s.idleThresholdSec / 60);
      if (idleResetMin) idleResetMin.value = Math.round(s.idleResetDelaySec / 60);
      text(idleResetOut, `${idleResetMin ? idleResetMin.value : 5} 分`);
      text(workOut,  `${workMin ? workMin.value : ''} 分`);
      text(breakOut, formatSec(breakSec ? breakSec.value : 0));
      text(idleOut,  `${idleMin ? idleMin.value : ''} 分`);
      paintMode(s.reminderMode);
      if (soundEnabled)      soundEnabled.checked      = !!s.soundEnabled;
      if (allowSkip)         allowSkip.checked         = !!s.allowSkip;
      if (autoLaunch)        autoLaunch.checked        = !!s.autoLaunch;
      if (miniTimerEnabled) miniTimerEnabled.checked = s.miniTimerEnabled !== false;
      if (preWarningEnabled) preWarningEnabled.checked = s.preWarningEnabled === false;
      if (preWarnSec) preWarnSec.disabled = s.preWarningEnabled === false;
      if (preWarnSec)        preWarnSec.value          = s.preWarningSec || 60;
      text(preWarnOut, formatSec(preWarnSec ? preWarnSec.value : 60));
      if (longBreakEnabled)   longBreakEnabled.checked   = s.longBreakEnabled !== false;
      if (longEvery)          longEvery.value            = s.longBreakEvery || 3;
      text(longEveryOut, `${longEvery ? longEvery.value : 3} 次`);
      if (longDur)            longDur.value              = s.longBreakDurationSec || 180;
      text(longDurOut, formatSec(longDur ? longDur.value : 180));
      if (forceLongAfterSkip) forceLongAfterSkip.checked = s.forceLongBreakAfterSkip !== false;
      paintSliders();
    } catch (err) {
      console.error('[EyeRest settings] loadSettings failed:', err);
    }
  }

  async function save(partial) {
    const saveState = $('saveState');
    text(saveState, '儲存中…');
    try {
      await window.eyerest.setSettings(partial);
      text(saveState, '變更已儲存');
      if (saveState) saveState.dataset.state = 'saved';
    } catch (err) {
      text(saveState, '儲存失敗，請重新調整以重試');
      if (saveState) saveState.dataset.state = 'error';
      console.error('[EyeRest settings] save failed:', err);
    }
  }

  async function refreshStatus() {
    if (!statusEl) return;
    try {
      const state = await window.eyerest.getTimerState();
      if (!state) { statusEl.textContent = '尚未連線'; return; }
      gameError.textContent = state.gameDetectionError ? '遊戲偵測無法啟動，倒數照常進行。請重新勾選以重試。' : '';
      if (state.paused) {
        statusEl.textContent = '已暫停';
        text(pauseToggleBtn, '繼續');
      } else if (state.gamePauseName) {
        statusEl.textContent = `遊戲中，倒數已暫停 · ${state.gamePauseName}`;
        text(pauseToggleBtn, '暫停');
      } else if (state.idlePaused) {
        const r = Math.max(0, state.workDurationSec - state.workElapsedSec);
        statusEl.textContent = state.idleReset ? '閒置已重設，等待回來後倒數'
          : `閒置暫停 · 保留 ${formatSec(r)}`;
        text(pauseToggleBtn, '暫停');
      } else if (state.phase === 'break') {
        const r = Math.max(0, state.breakDurationSec - state.breakElapsedSec);
        statusEl.textContent = `休息中 · 還剩 ${r} 秒`;
        text(pauseToggleBtn, '暫停');
      } else {
        const r = Math.max(0, state.workDurationSec - state.workElapsedSec);
        const m = Math.floor(r / 60);
        const sec = r % 60;
        statusEl.textContent = `距下次休息 ${m}:${String(sec).padStart(2, '0')}`;
        text(pauseToggleBtn, '暫停');
      }
    } catch (err) {
      console.error('[EyeRest settings] refreshStatus failed:', err);
      statusEl.textContent = '讀取狀態失敗';
    }
  }

  // --- slider live updates (also updates on every `input` while dragging) ---
  function bindSlider(input, out, mkSaved) {
    if (!input) return;
    const update = () => { text(out, mkSaved.label(input.value)); paintSliders(); };
    input.addEventListener('input',  update);
    input.addEventListener('change', () => { update(); save(mkSaved.save(input.value)); });
  }

  bindSlider(workMin, workOut, {
    label: (v) => `${v} 分`,
    save:  (v) => ({ workDurationSec: Number(v) * 60 }),
  });
  bindSlider(miniTimerOpacity, miniTimerOpacityOut, {
    label: (v) => `${v}%`,
    save: (v) => ({ miniTimerOpacity: Number(v) }),
  });
  bindSlider(breakSec, breakOut, {
    label: (v) => formatSec(v),
    save:  (v) => ({ breakDurationSec: Number(v) }),
  });
  bindSlider(idleMin, idleOut, {
    label: (v) => `${v} 分`,
    save:  (v) => ({ idleThresholdSec: Number(v) * 60 }),
  });
  bindSlider(idleResetMin, idleResetOut, {
    label: (v) => `${v} 分`,
    save: (v) => ({ idleResetDelaySec: Number(v) * 60 }),
  });
  bindSlider(preWarnSec, preWarnOut, {
    label: (v) => formatSec(v),
    save:  (v) => ({ preWarningSec: Number(v) }),
  });
  bindSlider(longEvery, longEveryOut, {
    label: (v) => `${v} 次`,
    save:  (v) => ({ longBreakEvery: Number(v) }),
  });
  bindSlider(longDur, longDurOut, {
    label: (v) => formatSec(v),
    save:  (v) => ({ longBreakDurationSec: Number(v) }),
  });

  // --- segmented "reminder mode" ---
  if (modeSeg) {
    modeSeg.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      paintMode(btn.dataset.value);
      save({ reminderMode: btn.dataset.value });
    });
  }

  // --- toggles ---
  if (miniTimerEnabled) miniTimerEnabled.addEventListener('change', () => save({ miniTimerEnabled: miniTimerEnabled.checked }));
  if (soundEnabled)      soundEnabled.addEventListener('change',      () => save({ soundEnabled:      soundEnabled.checked }));
  if (allowSkip)         allowSkip.addEventListener('change',         () => save({ allowSkip:         allowSkip.checked }));
  if (autoLaunch)        autoLaunch.addEventListener('change',        () => save({ autoLaunch:        autoLaunch.checked }));
  if (preWarningEnabled) preWarningEnabled.addEventListener('change', () => {
    preWarnSec.disabled = preWarningEnabled.checked;
    save({ preWarningEnabled: !preWarningEnabled.checked });
  });
  if (longBreakEnabled)  longBreakEnabled.addEventListener('change',  () => save({ longBreakEnabled:  longBreakEnabled.checked }));
  if (forceLongAfterSkip) forceLongAfterSkip.addEventListener('change', () => save({ forceLongBreakAfterSkip: forceLongAfterSkip.checked }));

  // --- buttons ---
  if (breakNowBtn)    breakNowBtn.addEventListener('click',    () => window.eyerest.breakNow());
  if (pauseToggleBtn) pauseToggleBtn.addEventListener('click', async () => {
    try { await window.eyerest.pauseToggle(); } catch (e) { console.error(e); }
    refreshStatus();
  });

  // --- IPC events from main process ---
  if (window.eyerest) {
    if (window.eyerest.onTick)     window.eyerest.onTick(    () => refreshStatus());
    if (window.eyerest.onSettings) window.eyerest.onSettings(() => loadSettings());
    if (window.eyerest.onState)    window.eyerest.onState(   () => refreshStatus());
  }

  // --- initial paint + polling fallback (every 1s) ---
  loadSettings();
  refreshStatus();
  setInterval(refreshStatus, 1000);
}
