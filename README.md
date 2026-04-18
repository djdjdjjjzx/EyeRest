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

## 為什麼要用 EyeRest？

盯螢幕一整天，眼睛很快就會乾澀痠痛。眼科醫師建議的 **20-20-20 法則**：每 20 分鐘，看 20 英尺（約 6 公尺）外的物體至少 20 秒，能有效緩解眼睛疲勞。

但市面上多數提醒工具有兩個煩人的地方：

- **你離開座位去倒杯水回來，它照樣跳出來叫你休息。**
- **你正在打線上遊戲 / 開會，時間一到就整個畫面被蓋掉。**

EyeRest 解決了這兩件事。

---

## 功能

- **20-20-20 提醒**：預設工作 20 分鐘 / 休息 20 秒，全部可調
- **智慧閒置偵測**：超過 2 分鐘（可調）沒碰鍵鼠 → 計時器自動歸零，回來不會被立刻打斷
- **19 分預先警告**：休息前 1 分鐘跳出小視窗，給你三個選擇：
  - `立刻休息`
  - `再 3 分鐘`
  - `Skip`（這次不休息，重新算 20 分）
- **三種提醒模式**：
  - 全螢幕 — 最強制
  - 半透明覆蓋 — 較溫和
  - 角落通知 — 最不打擾
- **山林藍綠配色** + 呼吸引導動畫的休息畫面
- **系統匣圖示**：隨時暫停、跳過、立刻休息、看統計
- **開機自動啟動**（選用）
- **每日統計**：完成週期數、總休息秒數

---

## 下載與安裝

### Windows

1. 到 [Releases 頁面](https://github.com/djdjdjjjzx/EyeRest/releases/latest) 下載 `EyeRest Setup X.X.X.exe`
2. 雙擊安裝
3. 第一次執行時 Windows SmartScreen 會跳警告（因為 app 沒買付費簽章）→ 點「**更多資訊**」→「**仍要執行**」
4. 安裝完啟動後，右下角系統匣會出現 EyeRest 眼睛小圖示，右鍵就能進入設定

### macOS

目前需要自行從原始碼打包（見下方 [從原始碼建置](#從原始碼建置)）。正式的 `.dmg` release 會在之後推出。

---

## 使用方式

- **系統匣右鍵** → 立刻休息 / 跳過下一次 / 暫停 / 設定 / 統計 / 結束
- **設定視窗** → 調整時間、切換提醒模式、開關音效與開機啟動、開關預先警告
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

# 打包成安裝檔
npm run dist:win    # Windows → dist/EyeRest Setup X.X.X.exe
npm run dist:mac    # macOS   → dist/EyeRest-X.X.X.dmg
```

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
│   │   ├── windows.js       休息 / 設定 / 統計 / 預警視窗
│   │   └── autostart.js     開機自動啟動
│   ├── preload/
│   │   └── preload.js       渲染程序與主程序的安全橋接
│   └── renderer/            使用者介面
│       ├── break/           休息引導畫面
│       ├── prewarn/         預先警告小視窗
│       ├── settings/        設定
│       └── stats/           統計
├── assets/icons/            app 圖示與系統匣圖示
├── test/                    Timer 狀態機單元測試
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
