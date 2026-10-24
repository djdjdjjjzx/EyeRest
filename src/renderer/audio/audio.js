const { t } = window.i18n;
window.eyerest.onSound(({ kind, volume }) => {
  document.querySelectorAll('audio').forEach(audio => { audio.pause(); audio.currentTime = 0; });
  const audio = document.getElementById(kind);
  if (!audio) return;
  audio.volume = Math.max(0, Math.min(1, volume / 100));
  audio.play().catch(error => console.error(t("EyeRest 音效播放失敗"), error));
});
