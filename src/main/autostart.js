// autostart.js — manage launch-on-login behavior.
// Uses Electron's built-in app.setLoginItemSettings (works on macOS & Windows).

const { app } = require('electron');

async function applyAutoLaunch(enabled) {
  app.setLoginItemSettings({
    openAtLogin: !!enabled,
    openAsHidden: true, // start in tray, no visible window
  });
}

function isAutoLaunchEnabled() {
  const s = app.getLoginItemSettings();
  return !!s.openAtLogin;
}

module.exports = { applyAutoLaunch, isAutoLaunchEnabled };
