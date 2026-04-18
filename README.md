# EyeRest

跨平台（Windows + macOS）的護眼提醒小工具，基於 **20-20-20 護眼法則**：
每工作 20 分鐘，提醒你看 6 公尺外的物體 20 秒，讓眼睛放鬆。

比一般 Pomodoro 更聰明的地方：**它會偵測你是否真的在電腦前**。
如果你離開座位超過 2 分鐘（可調整），計時器會自動歸零 — 因為你已經在休息了，不必再被提醒一次。

---

## 特色

- **20-20-20 護眼法則**：預設 20 分工作 / 20 秒休息，皆可調整
- **智慧閒置偵測**：離開座位達設定門檻 → 計時器自動重置
- **三種提醒模式**：
  - 全螢幕遮蔽（最強制）
  - 半透明覆蓋（較溫和）
  - 角落通知 + 小視窗（最不打擾）
- **山林藍綠**的休息畫面，搭配呼吸引導動畫
- **系統匣（Tray）圖示**：隨時暫停 / 立刻休息 / 跳過下一次
- **開機自動啟動**（macOS + Windows）
- **每日統計**：完成週期數、總休息時間、連續天數

---

## 給完全沒寫過程式的你：第一次跑起來

### 1. 安裝 Node.js

到 <https://nodejs.org/> 下載 **LTS 版本**（左邊那顆按鈕），一路「下一步」裝完。

驗證：開啟 **PowerShell**（Windows）或 **Terminal**（Mac），輸入：

```bash
node --version
```

應該會看到類似 `v20.xx.x`。

### 2. 下載這個專案的程式碼

假設你已經在 GitHub 建好 `EyeRest` repo，在你想放程式碼的資料夾打開終端機：

```bash
git clone https://github.com/<你的GitHub帳號>/EyeRest.git
cd EyeRest
```

（第一次推上 GitHub 的指令在本檔案最後。）

### 3. 安裝依賴套件

```bash
npm install
```

這會下載 Electron、auto-launch、electron-store 等套件（約 300MB，放在 `node_modules/`）。

### 4. 跑起來

```bash
npm start
```

Electron 會啟動。你會在系統匣（Windows 右下角 / Mac 右上角）看到 EyeRest 的圖示。右鍵點它就能設定。

> ⚠️ 第一次跑沒有圖示？那是因為預設沒附圖檔。參見下方「加上圖示與音效」。

### 5. 打包成可執行檔（之後可以雙擊跑）

```bash
# 打包成 Windows 的 .exe 安裝檔
npm run dist:win

# 打包成 Mac 的 .dmg
npm run dist:mac
```

輸出會放在 `dist/` 資料夾。

---

## 給自己的使用小抄

- **右下角 tray 圖示右鍵** → 暫停 / 跳過 / 立刻休息 / 設定 / 統計 / 結束
- **設定視窗**：拉 slider 調整時間、切換提醒模式、開關音效與開機啟動
- **統計視窗**：看過去 14 天柱狀圖與每日明細
- 休息畫面出現時：按 **Esc**（如果有開啟「允許跳過」）可提前結束

---

## 加上圖示與音效（可選）

把下列檔案放到對應位置後重新跑：

- `assets/icons/tray.png`（建議 32×32 PNG；Mac 建議用模板圖）
- `assets/icons/icon.ico`（Windows 安裝檔圖示）
- `assets/icons/icon.icns`（Mac app 圖示）
- `assets/sounds/chime.mp3`（休息提示音效）

沒放也能跑，只是 tray 會變成預設方塊、休息開始沒有叮咚聲。

---

## 專案結構

```
EyeRest/
├── src/
│   ├── main/                ← 主程序（背景執行）
│   │   ├── main.js          ← 入口
│   │   ├── timer.js         ← 20-20-20 狀態機 + 閒置偵測
│   │   ├── store.js         ← 設定與統計的持久化
│   │   ├── tray.js          ← 系統匣圖示與選單
│   │   ├── windows.js       ← 開啟休息 / 設定 / 統計視窗
│   │   └── autostart.js     ← 開機自動啟動
│   ├── preload/
│   │   └── preload.js       ← 安全 API 橋接
│   └── renderer/            ← 使用者看到的 UI
│       ├── break/           ← 休息引導畫面（山林藍綠）
│       ├── settings/        ← 設定
│       └── stats/           ← 統計
├── assets/                  ← 圖示與音效
├── package.json
└── README.md
```

---

## 第一次推上 GitHub（你已經建好空 repo 的情況）

在 `EyeRest/` 資料夾下打開終端機：

```bash
git init
git add .
git commit -m "Initial commit: EyeRest v0.1.0"
git branch -M main
git remote add origin https://github.com/<你的GitHub帳號>/EyeRest.git
git push -u origin main
```

之後要更新程式碼：

```bash
git add .
git commit -m "描述你這次改了什麼"
git push
```

---

## 授權

MIT License — 見 `LICENSE`。
