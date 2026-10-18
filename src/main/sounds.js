// One persistent audio window prevents duplicated audio on multiple monitors
// and lets the completion chime finish after the break windows close.
const { BrowserWindow } = require('electron');
const path = require('path');
let audioWindow;
let ready;

async function playSound(kind, settings, preview = false) {
  if (!['start', 'end'].includes(kind)) throw new Error('Unknown sound');
  const enabled = kind === 'start' ? settings.soundEnabled : settings.breakEndSoundEnabled;
  const volume = kind === 'start' ? settings.soundVolume : settings.breakEndSoundVolume;
  if ((!preview && !enabled) || volume === 0) return;
  if (!audioWindow || audioWindow.isDestroyed()) {
    audioWindow = new BrowserWindow({ show: false, webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true, nodeIntegration: false, autoplayPolicy: 'no-user-gesture-required',
    } });
    ready = audioWindow.loadFile(path.join(__dirname, '../renderer/audio/index.html'));
  }
  await ready;
  if (!audioWindow.isDestroyed()) audioWindow.webContents.send('eyerest:sound', { kind, volume });
}

module.exports = { playSound };
