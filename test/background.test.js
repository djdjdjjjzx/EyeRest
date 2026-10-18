// Real Electron import, persistence, IPC and renderer integration with isolated data.
const { app, BrowserWindow, ipcMain, nativeImage, dialog } = require('electron');
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fileURLToPath } = require('url');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eyerest-background-'));
app.setPath('userData', root);
app.on('window-all-closed', () => {});
const store = require('../src/main/store');
const { importBackground, registerBackgroundIpc } = require('../src/main/background');

app.whenReady().then(async () => {
  const source = path.join(root, '山林 #1 圖片.png');
  const png = nativeImage.createFromPath(path.join(__dirname, '../assets/icons/icon.png')).toPNG();
  fs.writeFileSync(source, png);
  assert.equal(store.getSettings().breakBackgroundImage, null);
  const jpegSource = path.join(root, 'photo.jpg');
  fs.writeFileSync(jpegSource, nativeImage.createFromBuffer(png).toJPEG(85));
  const jpeg = await importBackground(jpegSource);
  assert.ok(fs.existsSync(fileURLToPath(jpeg.breakBackgroundImage.url)), 'JPEG imports successfully');
  const updated = await importBackground(source);
  const background = updated.breakBackgroundImage;
  assert.equal(background.name, path.basename(source));
  const copy = fileURLToPath(background.url);
  assert.notEqual(copy, source);
  fs.unlinkSync(source);
  assert.deepEqual(fs.readFileSync(copy), png, 'import survives deletion of original');
  const saved = new (require('electron-store'))({ name: 'eyerest-config' });
  assert.deepEqual(saved.get('settings.breakBackgroundImage'), background, 'persisted on disk');
  const invalid = path.join(root, 'invalid.png');
  fs.writeFileSync(invalid, 'not an image');
  await assert.rejects(importBackground(invalid), /無法讀取/);
  await assert.rejects(importBackground(path.join(root, 'invalid.svg')), /PNG/);
  const large = path.join(root, 'large.png');
  fs.writeFileSync(large, Buffer.alloc(10 * 1024 * 1024 + 1));
  await assert.rejects(importBackground(large), /10 MB/);
  assert.deepEqual(store.getSettings().breakBackgroundImage, background, 'failed import preserves selection');

  registerBackgroundIpc((channel, settings) => {
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, settings);
  });
  ipcMain.handle('settings:get', () => store.getSettings());
  ipcMain.handle('timer:state', () => ({ phase: 'work', workDurationSec: 1200, workElapsedSec: 0 }));
  async function open(folder, query = {}) {
    const win = new BrowserWindow({ show: false, webPreferences: {
      preload: path.join(__dirname, '../src/preload/preload.js'), contextIsolation: true, nodeIntegration: false,
    } });
    await win.loadFile(path.join(__dirname, '../src/renderer', folder, 'index.html'), { query });
    return win;
  }
  async function until(win, condition) {
    return win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const deadline = Date.now() + 5000;
      const poll = () => {
        if (${condition}) return resolve(true);
        if (Date.now() > deadline) return reject(new Error('Timed out: ' + ${JSON.stringify(condition)}));
        setTimeout(poll, 20);
      }; poll();
    })`);
  }
  const settings = await open('settings');
  await until(settings, 'document.getElementById("backgroundPreview").naturalWidth > 0');
  assert.equal(await settings.webContents.executeJavaScript('document.getElementById("backgroundName").textContent'), background.name);
  const breaks = [];
  for (const mode of ['fullscreen', 'overlay', 'notification']) {
    const isLongBreak = mode === 'overlay';
    const win = await open('break', { mode, isLongBreak: String(isLongBreak), breakDurationSec: '180', allowSkip: 'true' });
    breaks.push(win);
    await until(win, 'document.body.classList.contains("has-background")');
    const result = await win.webContents.executeJavaScript(`({
      image: document.getElementById('breakBackground').naturalWidth,
      fit: getComputedStyle(document.getElementById('breakBackground')).objectFit,
      shade: !document.getElementById('backgroundShade').hidden,
      timer: document.getElementById('count').textContent,
      long: document.body.classList.contains('is-long'),
    })`);
    assert.ok(result.image > 0);
    assert.equal(result.fit, 'cover');
    assert.equal(result.shade, true);
    assert.equal(result.long, isLongBreak);
    assert.ok(Number(result.timer) > 0);
  }
  dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
  assert.deepEqual(await settings.webContents.executeJavaScript('window.eyerest.pickBreakBackground()'), { canceled: true });
  assert.deepEqual(store.getSettings().breakBackgroundImage, background);
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [invalid] });
  const failed = await settings.webContents.executeJavaScript('window.eyerest.pickBreakBackground()');
  assert.ok(failed.error.includes('無法讀取'));

  fs.writeFileSync(source, png);
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [source] });
  await settings.webContents.executeJavaScript('document.getElementById("pickBackground").click()');
  await until(settings, 'document.getElementById("backgroundStatus").textContent.includes("背景已儲存")');
  const replacement = store.getSettings().breakBackgroundImage;
  assert.notEqual(replacement.url, background.url);
  assert.equal(fs.existsSync(copy), false, 'replaced copy cleaned up');
  for (const win of breaks) {
    await until(win, `document.getElementById('breakBackground').src === ${JSON.stringify(replacement.url)} && document.body.classList.contains('has-background')`);
  }
  // Missing imported copy falls back without affecting the countdown or controls.
  fs.unlinkSync(fileURLToPath(replacement.url));
  const fallback = await open('break', { mode: 'fullscreen', allowSkip: 'true' });
  await until(fallback, 'document.getElementById("breakBackground").complete');
  assert.equal(await fallback.webContents.executeJavaScript('document.body.classList.contains("has-background")'), false);
  assert.equal(await fallback.webContents.executeJavaScript('document.getElementById("skip").hidden'), false);

  await settings.webContents.executeJavaScript('document.getElementById("clearBackground").click()');
  await until(settings, 'document.getElementById("backgroundName").textContent === "使用預設背景"');
  assert.equal(store.getSettings().breakBackgroundImage, null);
  for (const win of breaks) await until(win, '!document.body.classList.contains("has-background")');
  assert.equal(saved.get('settings.breakBackgroundImage'), null);
  console.log('Background integration passed: import, validation, private copy, persistence, preview, picker cancellation/errors, replacement, all modes, live updates, missing-image fallback and reset.');
  for (const win of BrowserWindow.getAllWindows()) win.destroy();
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });
