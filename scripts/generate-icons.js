// Run with: electron scripts/generate-icons.js
// SVG sources are kept alongside the generated platform assets.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('about:blank');
  const dir = path.join(__dirname, '../assets/icons');
  async function raster(source, size) {
    return Buffer.from(await win.webContents.executeJavaScript(`(async () => {
      const img = new Image(); img.src = ${JSON.stringify('data:image/svg+xml;base64,' + Buffer.from(source).toString('base64'))};
      await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = ${size};
      canvas.getContext('2d').drawImage(img, 0, 0, ${size}, ${size});
      return canvas.toDataURL('image/png').split(',')[1];
    })()`), 'base64');
  }
  const source = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
  const pngs = new Map();
  for (const size of sizes) pngs.set(size, await raster(source, size));
  fs.writeFileSync(path.join(dir, 'icon.png'), pngs.get(512));
  fs.writeFileSync(path.join(dir, 'icon-256.png'), pngs.get(256));
  fs.writeFileSync(path.join(dir, 'tray.png'), await raster(fs.readFileSync(path.join(dir, 'tray.svg'), 'utf8'), 32));
  const mono = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="black" fill-rule="evenodd" d="M2 16Q16 0 30 16Q16 32 2 16ZM10 16a6 6 0 1 0 12 0a6 6 0 1 0-12 0ZM13 16a3 3 0 1 0 6 0a3 3 0 1 0-6 0Z"/></svg>';
  fs.writeFileSync(path.join(dir, 'tray-mac.png'), await raster(mono, 16));
  fs.writeFileSync(path.join(dir, 'tray-mac@2x.png'), await raster(mono, 32));
  const icoSizes = sizes.filter(size => size <= 256);
  const header = Buffer.alloc(6 + icoSizes.length * 16);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(icoSizes.length, 4);
  let offset = header.length;
  icoSizes.forEach((size, i) => {
    const p = 6 + i * 16, png = pngs.get(size);
    header[p] = header[p + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, p + 4); header.writeUInt16LE(32, p + 6);
    header.writeUInt32LE(png.length, p + 8); header.writeUInt32LE(offset, p + 12);
    offset += png.length;
  });
  fs.writeFileSync(path.join(dir, 'icon.ico'), Buffer.concat([header, ...icoSizes.map(size => pngs.get(size))]));
  const chunks = [[128, 'ic07'], [256, 'ic08'], [512, 'ic09'], [1024, 'ic10']].map(([size, type]) => {
    const png = pngs.get(size), chunk = Buffer.alloc(8);
    chunk.write(type); chunk.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([chunk, png]);
  });
  const icns = Buffer.alloc(8); icns.write('icns'); icns.writeUInt32BE(8 + chunks.reduce((sum, c) => sum + c.length, 0), 4);
  fs.writeFileSync(path.join(dir, 'icon.icns'), Buffer.concat([icns, ...chunks]));
  console.log('Generated PNG, ICO, ICNS and template tray icons.'); app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
