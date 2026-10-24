// One translation implementation for native menus and sandboxed renderers.
(function (root) {
  const catalogs = typeof module === 'object' && module.exports ? {
    'zh-Hant': require('./locales/zh-Hant'),
    en: require('./locales/en'),
    ja: require('./locales/ja'),
    'zh-Hans': require('./locales/zh-Hans'),
  } : root.eyeRestLocales;
  const languages = Object.freeze(['zh-Hant', 'en', 'ja', 'zh-Hans']);
  function normalizeLanguage(language) {
    return languages.includes(language) ? language : 'zh-Hant';
  }
  function translate(language, key, values = {}) {
    const messages = catalogs[normalizeLanguage(language)];
    const message = Object.hasOwn(messages, key) ? messages[key] : key;
    return message.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
  }
  const api = { languages, normalizeLanguage, translate, catalogs };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.eyeRestI18n = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
