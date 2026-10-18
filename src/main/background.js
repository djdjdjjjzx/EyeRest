// Import a private copy so moving the original picture does not break the setting.
const { app, BrowserWindow, dialog, ipcMain, nativeImage } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { pathToFileURL, fileURLToPath } = require('url');
const store = require('./store');

const MAX_BYTES = 10 * 1024 * 1024;
const EXTENSIONS = ['png', 'jpg', 'jpeg'];

async function importBackground(file) {
  const extension = path.extname(file).slice(1).toLowerCase();
  if (!EXTENSIONS.includes(extension)) throw new Error('請選擇 PNG 或 JPG 圖片。');
  const info = await fs.stat(file);
  if (!info.isFile() || info.size > MAX_BYTES) throw new Error('圖片大小不可超過 10 MB。');
  const bytes = await fs.readFile(file);
  if (bytes.length > MAX_BYTES) throw new Error('圖片大小不可超過 10 MB。');
  const image = nativeImage.createFromBuffer(bytes);
  if (image.isEmpty()) throw new Error('無法讀取這張圖片，請選擇其他圖片。');
  const { width, height } = image.getSize();
  if (width * height > 32000000) throw new Error('圖片解析度過高，請縮小至 3,200 萬像素以內。');
  const directory = path.join(app.getPath('userData'), 'backgrounds');
  await fs.mkdir(directory, { recursive: true });
  const destination = path.join(directory, `${randomUUID()}.${extension}`);
  await fs.writeFile(destination, bytes);
  const previous = store.getSettings().breakBackgroundImage;
  let updated;
  try {
    updated = store.updateSettings({ breakBackgroundImage: {
      url: pathToFileURL(destination).href, name: path.basename(file),
    } });
  } catch (error) {
    await fs.unlink(destination).catch(() => {});
    throw error;
  }
  await removeBackground(previous);
  return updated;
}

async function removeBackground(background) {
  if (!background?.url) return;
  try {
    const file = fileURLToPath(background.url);
    // Only remove copies owned by EyeRest.
    if (path.dirname(file) === path.join(app.getPath('userData'), 'backgrounds')) {
      await fs.unlink(file);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Background cleanup:', error);
  }
}

function registerBackgroundIpc(broadcast) {
  ipcMain.handle('background:pick', async (event) => {
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
      title: '選擇休息背景圖片', properties: ['openFile'],
      filters: [{ name: '背景圖片', extensions: EXTENSIONS }],
    });
    if (result.canceled || !result.filePaths.length) return { canceled: true };
    try {
      const updated = await importBackground(result.filePaths[0]);
      broadcast('eyerest:settings', updated);
      return { canceled: false };
    } catch (error) {
      return { error: error.message };
    }
  });
  ipcMain.handle('background:clear', async () => {
    const previous = store.getSettings().breakBackgroundImage;
    const updated = store.updateSettings({ breakBackgroundImage: null });
    broadcast('eyerest:settings', updated);
    await removeBackground(previous);
  });
}

module.exports = { registerBackgroundIpc, importBackground };
