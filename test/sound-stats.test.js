// Real Electron audio and settings/statistics integration, isolated from user data.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'eyerest-sound-stats-')));
app.on('window-all-closed', () => {});
const store = require('../src/main/store');
const { playSound } = require('../src/main/sounds');

app.whenReady().then(async () => {
  ipcMain.handle('settings:get', () => store.getSettings());
  assert.equal(store.getSettings().statsTimeZone, 'system');
  assert.equal(store.getSettings().breakEndSoundEnabled, true);
  assert.throws(() => store.updateSettings({ statsTimeZone: 'invalid' }));
  assert.equal(store.getSettings().statsTimeZone, 'system', 'invalid zone is not saved');
  store.updateSettings({ statsTimeZone: 'UTC', soundVolume: 500 });
  assert.equal(store.getSettings().soundVolume, 100);
  store.recordCompletedCycle(20, new Date('2026-10-17T17:30:00Z'));
  assert.equal(store.getStats()['2026-10-17'].cycles, 1);
  store.updateSettings({ statsTimeZone: 'Asia/Taipei', soundEnabled: false, breakEndSoundEnabled: false, soundVolume: 50 });
  assert.equal(store.getStats()['2026-10-18'].cycles, 1, 'existing new records regroup');
  assert.equal(store.getStats()['2026-10-17'], undefined);
  const backingStore = new (require('electron-store'))({ name: 'eyerest-config' });
  backingStore.set('stats', { '2026-10-16': { cycles: 2, totalRestSec: 40 } });
  assert.equal(store.getStats()['2026-10-16'].cycles, 2, 'legacy UTC daily totals remain intact');
  await playSound('start', store.getSettings());
  await playSound('end', store.getSettings());
  assert.equal(BrowserWindow.getAllWindows().length, 0, 'disabled cues create no audio window');
  await assert.rejects(playSound('bad', store.getSettings(), true));
  await playSound('end', store.getSettings(), true);
  const audio = BrowserWindow.getAllWindows()[0];
  const played = await audio.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const a = document.getElementById('end');
    const timeout = setTimeout(() => reject(new Error('Audio playback did not start')), 4000);
    const done = () => { clearTimeout(timeout); resolve({ volume: a.volume, duration: a.duration }); };
    if (!a.paused && a.currentTime > 0) done(); else a.addEventListener('playing', done, { once: true });
  })`);
  assert.equal(played.volume, 0.5);
  assert.ok(played.duration > 0, 'bundled completion WAV decodes and plays');
  assert.equal(audio.isVisible(), false);
  const endSource = await audio.webContents.executeJavaScript('document.getElementById("end").currentSrc');
  assert.ok(endSource.endsWith('/assets/sounds/end.wav'));
  store.updateSettings({ soundEnabled: true, breakEndSoundEnabled: true });
  await playSound('start', store.getSettings());
  assert.equal(BrowserWindow.getAllWindows().length, 1, 'audio window reused');
  assert.equal(await audio.webContents.executeJavaScript('document.getElementById("start").volume'), 0.5);
  const beforeMute = await audio.webContents.executeJavaScript('document.getElementById("start").currentTime');
  store.updateSettings({ breakEndSoundVolume: 0 });
  await playSound('end', store.getSettings(), true);
  assert.equal(await audio.webContents.executeJavaScript('document.getElementById("end").paused'), true, 'zero-volume preview does not play');
  assert.ok(await audio.webContents.executeJavaScript('document.getElementById("start").currentTime') >= beforeMute);
  store.updateSettings({ breakEndSoundVolume: 50 });
  ipcMain.handle('settings:set', (_e, partial) => store.updateSettings(partial));
  ipcMain.handle('timer:state', () => ({ phase: 'work', workDurationSec: 1200, workElapsedSec: 0 }));
  ipcMain.handle('stats:get', () => store.getStats());
  ipcMain.handle('stats:reset', () => store.resetStats());
  ipcMain.handle('sound:preview', (_e, kind) => playSound(kind, store.getSettings(), true));
  async function open(folder) {
    const win = new BrowserWindow({ show: false, webPreferences: {
      preload: path.join(__dirname, '../src/preload/preload.js'), contextIsolation: true, nodeIntegration: false,
    } });
    await win.loadFile(path.join(__dirname, '../src/renderer', folder, 'index.html'));
    await win.webContents.executeJavaScript('window.eyerest.getSettings()');
    return win;
  }
  const settings = await open('settings');
  assert.equal(await settings.webContents.executeJavaScript('document.getElementById("statsTimeZone").value'), 'Asia/Taipei');
  await settings.webContents.executeJavaScript(`(() => {
    const zone = document.getElementById('statsTimeZone'); zone.value = 'UTC'; zone.dispatchEvent(new Event('change'));
    const volume = document.getElementById('soundVolume'); volume.value = '25'; volume.dispatchEvent(new Event('change'));
    const endVolume = document.getElementById('breakEndSoundVolume'); endVolume.value = '75'; endVolume.dispatchEvent(new Event('change'));
    const end = document.getElementById('breakEndSoundEnabled'); end.checked = false; end.dispatchEvent(new Event('change'));
    return window.eyerest.getSettings();
  })()`);
  assert.equal(store.getSettings().statsTimeZone, 'UTC');
  assert.equal(store.getSettings().soundVolume, 25);
  assert.equal(store.getSettings().breakEndSoundVolume, 75);
  assert.equal(store.getSettings().breakEndSoundEnabled, false);
  const saved = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'eyerest-config.json'), 'utf8'));
  assert.equal(saved.settings.statsTimeZone, 'UTC', 'zone saved on disk');
  assert.equal(saved.settings.soundVolume, 25, 'volume saved on disk');
  assert.equal(saved.settings.breakEndSoundVolume, 75, 'end volume saved independently');
  const stats = await open('stats');
  await stats.webContents.executeJavaScript('window.eyerest.getStats()');
  assert.ok((await stats.webContents.executeJavaScript('document.getElementById("log").textContent')).includes('2026-10-17'));
  store.updateSettings({ statsTimeZone: 'Asia/Taipei' });
  stats.webContents.send('eyerest:settings', store.getSettings());
  await stats.webContents.executeJavaScript('window.eyerest.getStats()');
  await stats.webContents.executeJavaScript('window.eyerest.getStats()');
  assert.ok((await stats.webContents.executeJavaScript('document.getElementById("log").textContent')).includes('2026-10-18'));
  store.resetStats();
  assert.deepEqual(store.getStats(), {});
  console.log('Sound/statistics integration passed: settings persistence, validation, regrouping, mute, volume, actual WAV playback, single hidden player and live statistics refresh.');
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });
