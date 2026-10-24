const { t } = window.i18n;
let lastState;
window.addEventListener('eyerest:language', () => { if (lastState) paint(lastState); });
const pill = document.getElementById('pill');
const label = document.getElementById('label');
const remaining = document.getElementById('remaining');
const button = document.getElementById('timer');
window.eyerest.onMiniAppearance(({ active, opacity }) => {
  document.body.classList.toggle('nearby', active);
  document.documentElement.style.setProperty('--idle-opacity', opacity);
});
function paint(state) {
  lastState = state;
  const resting = state.phase === 'break';
  const seconds = Math.max(0, Math.ceil(resting
    ? state.breakDurationSec - state.breakElapsedSec
    : state.workDurationSec - state.workElapsedSec));
  const paused = state.paused || !!state.gamePauseName || state.idlePaused;
  label.textContent = state.paused ? t("已暫停") : state.gamePauseName ? t("遊戲中 · 暫停")
    : state.idlePaused ? (state.idleReset ? t("已重設 · 等待回來") : t("閒置暫停"))
    : resting ? (state.isLongBreak ? t("長休息中") : t("休息中")) : t("下次休息");
  remaining.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  pill.className = `pill${paused ? ' paused' : resting ? ' resting' : seconds <= 60 ? ' soon' : ''}`;
  button.title = t("{p0} {p1} · 左鍵或右鍵開啟選單", { p0: label.textContent, p1: remaining.textContent });
  button.setAttribute('aria-label', button.title);
}
button.addEventListener('click', () => window.eyerest.openMiniTimerMenu().catch(console.error));
window.eyerest.onTick(paint);
window.eyerest.onState(paint);
window.eyerest.onBreakStart(paint);
window.eyerest.onBreakEnd(({ state }) => paint(state));
window.eyerest.onIdleReset(paint);
window.eyerest.getTimerState().then(paint).catch(console.error);
