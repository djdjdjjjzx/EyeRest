// Capture only the original static text nodes. Dynamic values are translated by
// their renderers; language updates never rebuild controls or their event handlers.
(() => {
  const { translate, normalizeLanguage, catalogs } = window.eyeRestI18n;
  let language = 'zh-Hant';
  let initialized = false;
  const t = (key, values) => translate(language, key, values);
  window.i18n = { t, get language() { return language; } };
  const texts = [];
  const attributes = [];
  const dynamicIds = new Set(['status', 'backgroundName',
    'workOut', 'breakOut', 'idleOut', 'idleResetOut', 'preWarnOut', 'longEveryOut', 'longDurOut',
    'pauseToggle', 'label', 'breath', 'totalRest']);
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest('script, style') || dynamicIds.has(node.parentElement.id)) continue;
    const key = node.textContent.replace(/\s+/g, ' ').trim();
    if (Object.hasOwn(catalogs['zh-Hant'], key)) texts.push({ node, key,
      leading: node.textContent.match(/^\s*/)[0], trailing: node.textContent.match(/\s*$/)[0] });
  }
  document.querySelectorAll('*').forEach(node => {
    for (const name of ['title', 'aria-label', 'alt']) {
      const key = node.getAttribute(name);
      if (key && Object.hasOwn(catalogs['zh-Hant'], key)) attributes.push({ node, name, key });
    }
  });
  function apply(settings) {
    const next = normalizeLanguage(settings.language);
    if (initialized && language === next) return;
    language = next;
    initialized = true;
    document.documentElement.lang = language;
    for (const { node, key, leading, trailing } of texts) node.textContent = leading + t(key) + trailing;
    for (const { node, name, key } of attributes) node.setAttribute(name, t(key));
    window.dispatchEvent(new Event('eyerest:language'));
  }
  window.eyerest.onSettings(apply);
  window.eyerest.getSettings().then(apply).catch(console.error);
})();
