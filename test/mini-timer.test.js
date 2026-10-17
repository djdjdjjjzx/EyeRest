// Run with: node_modules/.bin/electron test/mini-timer.test.js
const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'eyerest-mini-test-'));
app.setPath('userData', profile);
const store = require('../src/main/store');
const mini = require('../src/main/mini-timer');
const { Timer } = require('../src/main/timer');

app.whenReady().then(async () => {
  const timer = new Timer({ getSettings: () => store.getSettings(), getIdleSeconds: () => 0 });
  ipcMain.handle('timer:state', () => timer.getState());
  let menu;
  let popupOptions;
  let closeCount = 0;
  let warningClosed = false;
  let settingsOpened = 0;
  const originalPopup = Menu.prototype.popup;
  const originalClosePopup = Menu.prototype.closePopup;
  const originalCursor = screen.getCursorScreenPoint;
  let cursor = { x: -10000, y: -10000 };
  screen.getCursorScreenPoint = () => cursor;
  Menu.prototype.popup = function (options) { menu = this; popupOptions = options; };
  Menu.prototype.closePopup = function (owner) {
    assert.equal(owner, BrowserWindow.getAllWindows()[0]);
    closeCount += 1;
    popupOptions.callback();
  };
  try {
    const openContextMenu = (event) => mini.showMenu(event, timer, { closePreWarning: () => { warningClosed = true; } }, () => setVisible(false));
    mini.sync(store.getSettings(), openContextMenu);
    let win = BrowserWindow.getAllWindows()[0];
    await new Promise(resolve => win.webContents.once('did-finish-load', resolve));
    const read = () => win.webContents.executeJavaScript('({ label: document.getElementById("label").textContent, time: document.getElementById("remaining").textContent, className: document.getElementById("pill").className })');
    // Await the preload's initial asynchronous state request.
    await win.webContents.executeJavaScript('window.eyerest.getTimerState().then(paint)');
    assert.equal((await read()).time, '20:00');
    assert.equal(win.isAlwaysOnTop(), true);
    assert.equal(win.isFocusable(), true);
    assert.deepEqual(win.getSize(), [204, 76]);
    await win.webContents.insertCSS('.pill, .handle { transition: none !important; }');
    const appearance = () => win.webContents.executeJavaScript('({ nearby: document.body.classList.contains("nearby"), opacity: getComputedStyle(document.getElementById("pill")).opacity })');
    assert.equal((await appearance()).opacity, '0.35', 'default floating timer is faint');
    const bounds = win.getBounds();
    cursor = { x: bounds.x - 20, y: bounds.y + 30 };
    await new Promise(resolve => setTimeout(resolve, 180));
    assert.equal((await appearance()).nearby, true, 'approaching outside the window reveals it');
    assert.equal((await appearance()).opacity, '1');
    cursor = { x: -10000, y: -10000 };
    mini.sync(store.updateSettings({ miniTimerOpacity: 55 }));
    assert.equal((await appearance()).nearby, false, 'leaving fades the timer');
    assert.equal((await appearance()).opacity, '0.55', 'opacity settings update the existing window');
    assert.equal(store.updateSettings({ miniTimerOpacity: 0 }).miniTimerOpacity, 15);
    assert.equal(store.updateSettings({ miniTimerOpacity: 200 }).miniTimerOpacity, 100);
    mini.sync(store.updateSettings({ miniTimerOpacity: 35 }));
    if (process.env.EYEREST_PREVIEW_PATH) {
      await win.webContents.executeJavaScript('window.eyerest.getTimerState().then(state => paint({ ...state, workElapsedSec: 212 }))');
      const preview = await win.webContents.capturePage();
      fs.writeFileSync(process.env.EYEREST_PREVIEW_PATH, preview.toPNG());
      await win.webContents.executeJavaScript('window.eyerest.getTimerState().then(paint)');
    }
    cursor = { x: bounds.x - 20, y: bounds.y + 30 };
    mini.sync(store.getSettings());
    await appearance();
    const handle = await win.webContents.executeJavaScript('({ width: document.querySelector(".handle").getBoundingClientRect().width, height: document.querySelector(".handle").getBoundingClientRect().height, region: getComputedStyle(document.querySelector(".handle")).webkitAppRegion })');
    assert.equal(handle.width, 64);
    assert.ok(handle.height >= 60);
    assert.equal(handle.region, 'drag');
    cursor = { x: -10000, y: -10000 };
    mini.sync(store.getSettings());
    assert.equal(win.isResizable(), false);
    const setVisible = (visible) => mini.sync(store.updateSettings({ miniTimerEnabled: visible }));
    const openMenu = () => mini.showMenu({ sender: win.webContents }, timer, {
      closePreWarning: () => { warningClosed = true; },
      openSettings: () => { settingsOpened += 1; },
    }, () => setVisible(false));
    for (const [target, name] of [[win.webContents, 'context-menu'], [win, 'system-context-menu']]) {
      let prevented = false;
      target.emit(name, { preventDefault: () => { prevented = true; } });
      assert.equal(prevented, true, 'right click suppresses the default menu');
      assert.deepEqual(menu.items.map(item => item.label), ['再 1 分鐘', '再 3 分鐘', '立即下一次休息', '暫停計時', '重新計時', '設定', '隱藏']);
      popupOptions.callback();
    }
    openMenu();
    assert.equal((await appearance()).opacity, '1', 'open menu keeps timer visible away from the pointer');
    win.emit('blur');
    assert.equal((await appearance()).opacity, '0.35', 'closing menu restores the idle appearance');
    assert.equal(closeCount, 1, 'losing focus dismisses the menu');
    win.emit('blur');
    assert.equal(closeCount, 1, 'already closed menu is not closed again');
    openMenu();
    openMenu();
    assert.equal(closeCount, 2, 'clicking timer again dismisses the menu');
    mini.showMenu({ sender: win.webContents }, timer, { closePreWarning: () => { warningClosed = true; } });
    assert.deepEqual(menu.items.map(item => item.label), ['再 1 分鐘', '再 3 分鐘', '立即下一次休息', '暫停計時', '重新計時', '設定', '隱藏']);
    menu.items[0].click();
    menu.items[1].click();
    assert.equal(timer.getState().workDurationSec, 1440);
    assert.equal(warningClosed, true);
    win.webContents.send('eyerest:tick', timer.getState());
    assert.equal((await read()).time, '24:00');
    timer.workElapsedSec = 1140; // Exactly five minutes left in the extended cycle.
    menu.items[3].click();
    assert.equal(timer.paused, true);
    for (let i = 0; i < 120; i += 1) timer._tick();
    assert.equal(timer.getState().workDurationSec - timer.workElapsedSec, 300, 'pause preserves the remaining five minutes');
    win.webContents.send('eyerest:tick', timer.getState());
    assert.equal((await read()).label, '已暫停');
    assert.equal((await read()).time, '5:00');
    popupOptions.callback();
    openMenu();
    assert.equal(menu.items[3].label, '開始計時');
    menu.items[3].click();
    assert.equal(timer.paused, false);
    assert.equal(timer.getState().workDurationSec - timer.workElapsedSec, 300, 'resume starts from the same five minutes');
    timer._tick();
    assert.equal(timer.getState().workDurationSec - timer.workElapsedSec, 299, 'countdown continues after resume');
    win.webContents.send('eyerest:tick', timer.getState());
    assert.equal((await read()).label, '下次休息');
    assert.equal((await read()).time, '4:59');
    popupOptions.callback();
    openMenu();
    assert.equal(menu.items[3].label, '暫停計時');
    timer.workElapsedSec = 1390;
    win.webContents.send('eyerest:tick', timer.getState());
    assert.match((await read()).className, /soon/);
    timer.togglePause();
    menu.items[2].click();
    assert.equal(timer.phase, 'break');
    assert.equal(timer.paused, false);
    popupOptions.callback();
    mini.showMenu({ sender: win.webContents }, timer, {});
    assert.equal(menu.items.slice(0, 3).every(item => !item.enabled), true);
    assert.equal(menu.items[3].enabled, true, 'pause is available during a break');
    win.setPosition(100, 100);
    win.emit('moved');
    const saved = store.getSettings().miniTimerPosition;
    assert.deepEqual(saved, { x: 100, y: 100 });
    popupOptions.callback();
    openMenu();
    menu.items.find(item => item.label === '設定').click();
    assert.equal(settingsOpened, 1, 'settings action opens the settings window');
    warningClosed = false;
    menu.items.find(item => item.label === '重新計時').click();
    assert.equal(warningClosed, true, 'restart dismisses the pre-warning');
    assert.equal(timer.phase, 'work', 'restart exits the break');
    assert.equal(timer.getState().workDurationSec - timer.workElapsedSec, 1200);
    win.webContents.send('eyerest:tick', timer.getState());
    assert.equal((await read()).time, '20:00', 'restart restores the configured countdown');
    timer.forceBreak();
    menu.items.find(item => item.label === '隱藏').click();
    assert.equal(BrowserWindow.getAllWindows().length, 0);
    assert.equal(store.getSettings().miniTimerEnabled, false, 'hiding updates the setting');
    const elapsed = timer.breakElapsedSec;
    timer._tick();
    assert.equal(timer.breakElapsedSec, elapsed + 1, 'timer keeps running while hidden');
    mini.sync(store.updateSettings({ soundEnabled: false }));
    assert.equal(BrowserWindow.getAllWindows().length, 0, 'unrelated settings do not reopen the window');
    const originalBuild = Menu.buildFromTemplate;
    let trayMenu;
    let tray;
    try {
      Menu.buildFromTemplate = function (template) {
        trayMenu = originalBuild.call(this, template);
        return trayMenu;
      };
      tray = require('../src/main/tray').createTray({ onShowMiniTimer: () => setVisible(true) });
      trayMenu.items.find(item => item.label === '顯示倒數浮窗').click();
    } finally {
      Menu.buildFromTemplate = originalBuild;
      if (tray) tray.destroy();
    }
    assert.equal(store.getSettings().miniTimerEnabled, true, 'tray action re-enables the window');
    win = BrowserWindow.getAllWindows()[0];
    assert.deepEqual(win.getPosition(), [100, 100]);
    mini.sync({ miniTimerEnabled: false });
    console.log('Mini timer Electron checks passed: hide, background countdown, tray restore, position, menu dismissal, pause/resume and controls.');
  } finally {
    Menu.prototype.popup = originalPopup;
    Menu.prototype.closePopup = originalClosePopup;
    screen.getCursorScreenPoint = originalCursor;
  }
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
