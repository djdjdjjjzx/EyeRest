// Run with Node; no Electron installation or user profile changes required.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const { languages, normalizeLanguage, translate, catalogs } = require('../src/shared/i18n');

const keys = Object.keys(catalogs['zh-Hant']).sort();
const placeholders = text => (text.match(/\{\w+\}/g) || []).sort();
for (const language of languages) {
  assert.deepEqual(Object.keys(catalogs[language]).sort(), keys, `${language}: complete catalog`);
  for (const key of keys) {
    assert.ok(catalogs[language][key].trim(), `${language}: nonempty translation of ${key}`);
    assert.deepEqual(placeholders(catalogs[language][key]), placeholders(key), `${language}: interpolation for ${key}`);
  }
}
assert.equal(normalizeLanguage('xx'), 'zh-Hant');
assert.equal(normalizeLanguage(null), 'zh-Hant');
assert.equal(translate('xx', '設定'), '設定');
assert.equal(translate('en', 'unknown key'), 'unknown key');
assert.equal(translate('en', 'toString'), 'toString', 'prototype names are not translations');
assert.equal(translate('en', '{p0} 分 {p1} 秒', { p0: 2, p1: 5 }), '2 min 5 sec');
assert.equal(translate('ja', '{p0} 分 {p1} 秒', { p0: 2, p1: 5 }), '2 分 5 秒');
assert.equal(translate('zh-Hans', '距下次休息 {p0}:{p1}', { p0: 3, p1: '09' }), '距下次休息 3:09');

// A fresh module instance models reopening the app with persisted preferences.
let data;
class MemoryStore {
  constructor({ defaults }) { data ||= structuredClone(defaults); }
  get(key, fallback) { return data[key] ?? fallback; }
  set(key, value) { data[key] = structuredClone(value); }
}
function load(filename, overrides) {
  const file = path.join(__dirname, '../src/main', filename);
  const localRequire = createRequire(file);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    module, __dirname: path.dirname(file), Buffer, console, process,
    require: name => Object.hasOwn(overrides, name) ? overrides[name] : localRequire(name),
  }, { filename: file });
  return module.exports;
}
const settings = () => load('store.js', { 'electron-store': MemoryStore });
let store = settings();
assert.equal(store.getSettings().language, 'zh-Hant', 'existing profiles default to Traditional Chinese');
for (const language of languages) {
  store.updateSettings({ language });
  store = settings();
  assert.equal(store.getSettings().language, language, 'selection survives module restart');
}
assert.equal(store.updateSettings({ language: '__proto__' }).language, 'zh-Hant');

// Native menus use the same current preference, including timed pause labels.
const nativeI18n = load('i18n.js', { './store': store });
let menu;
class Tray { setToolTip() {} setContextMenu(value) { menu = value; } }
const tray = load('tray.js', {
  './i18n': nativeI18n,
  electron: { Tray, Menu: { buildFromTemplate: value => value }, nativeImage: {
    createFromPath: () => ({ setTemplateImage() {} }), createFromBuffer: () => ({}),
  } },
});
tray.createTray({});
for (const [language, label] of [['en', 'Settings…'], ['ja', '設定…'], ['zh-Hans', '设置…'], ['zh-Hant', '設定…']]) {
  store.updateSettings({ language });
  tray.updateTrayMenu({ paused: false });
  assert.ok(menu.some(item => item.label === label), language + ' native tray label');
  tray.updateTrayMenu({ paused: true, pausedUntilMs: Date.now() + 120000 });
  assert.ok(menu.some(item => item.label === translate(language, '繼續（剩 {p0} 分）', { p0: 2 })));
}
console.log('Localization checks passed: catalog coverage, interpolation, fallback, preference persistence and native tray language changes.');
