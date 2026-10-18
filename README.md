# EyeRest

<p align="center">
  <strong>一個乾淨、優雅的護眼提醒小工具。</strong><br>
  跨平台（Windows / macOS），遵循 20-20-20 護眼法則，還會聰明地偵測你有沒有在座位上。
</p>

<p align="center">
  <a href="https://github.com/djdjdjjjzx/EyeRest/releases/latest">
    <img alt="下載最新版" src="https://img.shields.io/github/v/release/djdjdjjjzx/EyeRest?label=下載&color=2f8c82">
  </a>
  <img alt="授權" src="https://img.shields.io/badge/授權-MIT-blue">
  <img alt="平台" src="https://img.shields.io/badge/平台-Windows%20%7C%20macOS-lightgrey">
</p>

---

## v0.2.1 更新重點

- 浮窗平時自動淡化並略微縮小，滑鼠靠近或開啟選單時恢復清楚顯示。
- 系統偏好可調整浮窗平時不透明度（15%～100%，預設 35%），立即套用並儲存。
- 浮窗快捷選單新增「重新計時」與「設定」；重新計時會結束目前休息並重啟完整工作倒數。
- 提醒設定新增「關閉通知（休息前預告）」：勾選後立即關閉預告，到時間仍會正常提醒休息。

完整版本紀錄請見 [CHANGELOG](CHANGELOG.md)。

---

## 為什麼要用 EyeRest？

盯螢幕一整天，眼睛很快就會乾澀痠痛。眼科醫師建議的 **20-20-20 法則**：每 20 分鐘，看 20 英尺（約 6 公尺）外的物體至少 20 秒，能有效緩解眼睛疲勞。

但市面上多數提醒工具有兩個煩人的地方：

- **你離開座位去倒杯水回來，它照樣跳出來叫你休息。**
- **你正在打線上遊戲 / 開會，時間一到就整個畫面被蓋掉。**

EyeRest 解決了這兩件事。

---

## 功能

- **20-20-20 提醒**：預設工作 20 分鐘 / 休息 20 秒，全部可調
- **兩階段閒置偵測**：沒碰鍵鼠達 2 分鐘（可調）先暫停、保留剩餘時間；再閒置 5 分鐘（可調）才重設成完整工作時間，回來後再倒數。浮窗會顯示閒置暫停／已重設，閒置與睡眠時會關閉預警。未達暫停門檻前仍照常計時。
- **19 分預先警告**：休息前 1 分鐘跳出小視窗，給你三個選擇：
  - `立刻休息`
  - `再 3 分鐘`
  - `Skip`（這次不休息，重新算 20 分）
- **三種提醒模式**：
  - 全螢幕 — 最強制
  - 半透明覆蓋 — 較溫和
  - 角落通知 — 最不打擾
- **山林藍綠配色** + 呼吸引導動畫的休息畫面
- **自訂休息背景圖片**：設定 → 提醒體驗 → 休息背景圖片，選擇 PNG 或 JPG（最大 10 MB、3,200 萬像素）。自動保存圖片副本，一般與深度休息及三種提醒模式皆適用；可預覽、替換或恢復預設背景。圖片置中裁切並加上暗色遮罩，讀取失敗時使用預設背景。
- **深度休息**：預設每第 3 次休息延長為 3 分鐘，可調整頻率與時長；可設定跳過後下次改為深度休息。
- **遊戲期間暫停（Windows）**：在設定加入遊戲執行檔，只有所選遊戲位於前景時才會暫停倒數。
- **分類設定頁**：依工作與休息、提醒、深度休息、遊戲與系統偏好分區，變更自動儲存。
- **系統匣圖示**：隨時暫停、跳過、立刻休息、看統計
- **迷你倒數浮窗**：置頂顯示剩餘時間，拖曳左側可移動並記住位置；點擊時間或按右鍵，可再加 1／3 分鐘、立即休息、暫停／繼續或隱藏。隱藏後仍持續計時，可從系統匣恢復顯示。最後一分鐘轉為暖黃色，暫停及遊戲中會標示狀態。
- **浮窗淡化與快捷操作**：平時以可調整的不透明度淡化，滑鼠靠近時恢復完整外觀；選單可直接開啟設定或重新計時。重新計時會清除已經過時間、額外延長、手動暫停與跳過標記；遊戲與閒置等自動暫停條件仍適用。
- **關閉休息前預告**：在提醒設定勾選「關閉通知（休息前預告）」，只關閉預告小視窗，保留正式休息提醒。
- **開機自動啟動**（選用）
- **每日統計**：完成週期數、總休息秒數
- **內建開始／結束提示音**：兩種提示可分別開關，調整各自音量並試聽；只有完整休息完成才播放結束音，多螢幕不重複播放。
- **自訂統計時區**：在系統偏好選擇跟隨系統（預設）、台北、UTC 或其他地區時區，今日與近 14 天圖表使用同一時區。新紀錄保存完成時間，切換時區時重新歸日；舊版每日總計缺少時間戳記，保留原 UTC 日期，無法精確換算。時區設定不影響休息倒數。

---

## 下載與安裝

### Windows

1. 到 [Releases 頁面](https://github.com/djdjdjjjzx/EyeRest/releases/latest) 下載 `EyeRest.Setup.0.2.1.exe`（Windows x64）
2. 雙擊安裝
3. 第一次執行時 Windows SmartScreen 會跳警告（因為 app 沒買付費簽章）→ 點「**更多資訊**」→「**仍要執行**」
4. 安裝完啟動後，右下角系統匣會出現 EyeRest 眼睛小圖示，右鍵就能進入設定

### macOS

目前需要自行從原始碼打包（見下方 [從原始碼建置](#從原始碼建置)）。正式的 `.dmg` release 會在之後推出。

---

## 使用方式

- **系統匣右鍵** → 立刻休息 / 跳過下一次 / 暫停 / 顯示倒數浮窗 / 設定 / 統計 / 結束
- **設定視窗** → 調整工作與休息時間、閒置門檻、深度休息、提醒模式、遊戲清單、音效與開機啟動
- **浮窗點擊時間或右鍵** → 延長倒數 / 立即休息 / 暫停或繼續 / 重新計時 / 設定 / 隱藏
- **預先警告小視窗** → 休息前 1 分鐘跳出，三個按鈕選擇
- **休息畫面** → 如果有開「允許跳過」，按 **Esc** 可提前結束

---

## 從原始碼建置

需要 [Node.js 18+](https://nodejs.org/)。

```bash
git clone https://github.com/djdjdjjjzx/EyeRest.git
cd EyeRest
npm install

# 開發模式（直接跑）
npm start

# 跑測試
npm test

# 迷你浮窗 Electron 整合測試
npm run test:mini

# 閒置偵測與設定頁 Electron 整合測試
npm run test:idle

# 提示音與統計時區 Electron 整合測試
npm run test:sound-stats

# 自訂休息背景 Electron 整合測試
npm run test:background

# 修改 SVG 後重新產生各平台圖示
npm run icons

# 打包成安裝檔
npm run dist:win    # Windows → dist/EyeRest Setup X.X.X.exe
npm run dist:mac    # macOS   → dist/EyeRest-X.X.X.dmg
```

打包指令請在對應作業系統執行。Windows 安裝程式尚未簽章，macOS 安裝包尚未提供。

---

## 專案結構

```
EyeRest/
├── src/
│   ├── main/                主程序（背景常駐）
│   │   ├── main.js          入口 + IPC
│   │   ├── timer.js         20-20-20 狀態機 + 閒置偵測
│   │   ├── store.js         設定與統計的持久化
│   │   ├── tray.js          系統匣圖示與選單
│   │   ├── mini-timer.js    倒數浮窗與快捷選單
│   │   ├── game-monitor.js  Windows 前景遊戲偵測
│   │   ├── windows.js       休息 / 設定 / 統計 / 預警視窗
│   │   └── autostart.js     開機自動啟動
│   ├── preload/
│   │   └── preload.js       渲染程序與主程序的安全橋接
│   └── renderer/            使用者介面
│       ├── break/           休息引導畫面
│       ├── prewarn/         預先警告小視窗
│       ├── mini-timer/      迷你倒數浮窗
│       ├── settings/        設定
│       └── stats/           統計
├── assets/icons/            app 圖示與系統匣圖示
├── scripts/                 圖示產生工具
├── test/                    狀態機與 Electron 整合測試
├── CHANGELOG.md             版本更新紀錄
└── package.json
```

---

## 技術棧

- [Electron](https://www.electronjs.org/) 30
- [electron-store](https://github.com/sindresorhus/electron-store) — 設定持久化
- [auto-launch](https://github.com/Teamwork/node-auto-launch) — 開機啟動
- [electron-builder](https://www.electron.build/) — 打包

---

## 授權

[MIT](LICENSE)
