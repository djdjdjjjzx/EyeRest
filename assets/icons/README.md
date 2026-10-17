# EyeRest 圖示

亮綠底與深色眼睛提高小尺寸辨識度。系統匣使用簡化線條，macOS 使用透明背景的單色模板。

- `icon.svg`：應用程式與設定頁的向量原稿。
- `tray.svg`：32px 系統匣專用向量原稿。
- `icon.png` / `icon-256.png`：512px / 256px PNG。
- `icon.ico`：Windows 多尺寸圖示（16、24、32、48、64、128、256px）。
- `icon.icns`：macOS 圖示（128、256、512、1024px）。
- `tray.png`：32px 彩色系統匣圖示。
- `tray-mac.png` / `tray-mac@2x.png`：16px / 32px macOS 模板圖示。

編輯 SVG 後，執行 `npm run icons` 重新產生平台圖示。需要已安裝專案的 Electron 開發相依套件；不需額外影像處理套件。macOS 模板原稿位於 `scripts/generate-icons.js`。
