// Run with: electron test/idle-ui.test.js (isolated profile, no real idle waits).
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'eyerest-idle-test-')));
app.on('window-all-closed', () => {});
const store = require('../src/main/store');
const { Timer } = require('../src/main/timer');

app.whenReady().then(async () => {
  let idle = 0;
  let closed = 0;
  const timer = new Timer({ getSettings: () => store.getSettings(), getIdleSeconds: () => idle });
  ipcMain.handle('timer:state', () => timer.getState());
  ipcMain.handle('settings:get', () => store.getSettings());
  ipcMain.handle('settings:set', (_event, partial) => store.updateSettings(partial));
  ipcMain.handle('prewarn:close', () => { closed += 1; });
  const open = async (folder) => {
    const win = new BrowserWindow({ show: false, webPreferences: {
      preload: path.join(__dirname, '../src/preload/preload.js'), contextIsolation: true, nodeIntegration: false,
    } });
    await win.loadFile(path.join(__dirname, '../src/renderer', folder, 'index.html'));
    return win;
  };
  assert.equal(store.getSettings().idleResetDelaySec, 300, 'old settings receive a default delay');
  const settings = await open('settings');
  // Allow the renderer's initial IPC reads to finish.
  await settings.webContents.executeJavaScript('window.eyerest.getSettings()');
  assert.equal(await settings.webContents.executeJavaScript('document.getElementById("idleResetMin").value'), '5');
  await settings.webContents.executeJavaScript(`(() => {
    const slider = document.getElementById('idleResetMin');
    slider.value = '10'; slider.dispatchEvent(new Event('change'));
    return window.eyerest.getSettings();
  })()`);
  assert.equal(store.getSettings().idleResetDelaySec, 600, 'new slider persists seconds');
  store.updateSettings({ idleResetDelaySec: 300 });
  settings.destroy();

  const mini = await open('mini-timer');
  const paint = async () => mini.webContents.executeJavaScript('window.eyerest.getTimerState().then(paint)');
  const label = () => mini.webContents.executeJavaScript('document.getElementById("label").textContent');
  timer.workElapsedSec = 600;
  idle = 120; timer._tick(); await paint();
  assert.equal(await label(), '閒置暫停');
  assert.equal(await mini.webContents.executeJavaScript('document.getElementById("remaining").textContent'), '10:00');
  idle = 420; timer._tick(); await paint();
  assert.equal(await label(), '已重設 · 等待回來');
  idle = 0; timer._tick(); await paint();
  assert.equal(await label(), '下次休息');
  mini.destroy();

  timer.workElapsedSec = 1140;
  const warning = await open('prewarn');
  await warning.webContents.executeJavaScript('window.eyerest.getTimerState()');
  const countdown = () => warning.webContents.executeJavaScript('document.getElementById("countdown").textContent');
  assert.equal(await countdown(), '1:00');
  timer.extendWork(1);
  warning.webContents.send('eyerest:tick', timer.getState());
  assert.equal(await countdown(), '2:00', 'warning follows the main timer after extension');
  idle = 120; timer._tick();
  warning.webContents.send('eyerest:tick', timer.getState());
  await warning.webContents.executeJavaScript('window.eyerest.getTimerState()');
  assert.ok(closed > 0, 'warning requests dismissal when idle paused');
  warning.destroy();
  console.log('Idle UI checks passed: default settings, slider persistence, idle labels, remaining time, warning synchronization and dismissal.');
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
