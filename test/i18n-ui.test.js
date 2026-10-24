// Exercise actual renderer language changes and persistent settings in an isolated profile.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'eyerest-i18n-ui-')));
app.on('window-all-closed', () => {});
const store = require('../src/main/store');
const { translate } = require('../src/shared/i18n');
const state = { phase: 'work', workDurationSec: 1200, workElapsedSec: 0 };

app.whenReady().then(async () => {
  ipcMain.handle('settings:get', () => store.getSettings());
  ipcMain.handle('timer:state', () => state);
  ipcMain.handle('settings:set', (_event, partial) => {
    const settings = store.updateSettings(partial);
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send('eyerest:settings', settings);
    return settings;
  });
  async function open(folder) {
    const win = new BrowserWindow({ show: false, webPreferences: {
      preload: path.join(__dirname, '../src/preload/preload.js'), contextIsolation: true, nodeIntegration: false,
    } });
    await win.loadFile(path.join(__dirname, '../src/renderer', folder, 'index.html'));
    return win;
  }
  async function waitForLanguage(win, language) {
    await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const deadline = Date.now() + 4000;
      function poll() {
        if (document.documentElement.lang === ${JSON.stringify(language)}) return resolve();
        if (Date.now() > deadline) return reject(new Error('Language update timed out'));
        setTimeout(poll, 20);
      }
      poll();
    })`);
  }
  store.updateSettings({ language: 'en' });
  const settings = await open('settings');
  const mini = await open('mini-timer');
  await settings.webContents.executeJavaScript('void (window.originalWorkSlider = document.getElementById("workMin"))');
  for (const language of ['en', 'ja', 'zh-Hans', 'zh-Hant']) {
    await settings.webContents.executeJavaScript(`(() => {
      const select = document.getElementById('language');
      select.value = ${JSON.stringify(language)};
      select.dispatchEvent(new Event('change'));
      return window.eyerest.getSettings();
    })()`);
    await waitForLanguage(settings, language);
    await waitForLanguage(mini, language);
    assert.equal(store.getSettings().language, language);
    assert.equal(await settings.webContents.executeJavaScript('document.querySelector("h1").textContent'), translate(language, '讓休息，成為日常。'));
    assert.equal(await mini.webContents.executeJavaScript('document.getElementById("label").textContent'), translate(language, '下次休息'));
    assert.equal(await mini.webContents.executeJavaScript('document.getElementById("remaining").textContent'), '20:00');
    assert.equal(await settings.webContents.executeJavaScript('window.originalWorkSlider === document.getElementById("workMin")'), true);
  }
  store.updateSettings({ language: 'ja' });
  settings.destroy(); mini.destroy();
  const reopened = await open('settings');
  await waitForLanguage(reopened, 'ja');
  assert.equal(await reopened.webContents.executeJavaScript('document.getElementById("language").value'), 'ja');
  reopened.destroy();
  console.log('Language UI checks passed: four live languages, persistent preference, reopen, static headings, dynamic countdown labels and preserved controls.');
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
