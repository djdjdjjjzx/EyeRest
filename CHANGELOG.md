# 版本紀錄 / Changelog

## 0.2.0 — 2026-10-17

### 新增
- 置頂迷你倒數浮窗，支援記住位置、延長 1／3 分鐘、立即休息、暫停／繼續與隱藏。
- 系統匣可恢復隱藏的浮窗；隱藏時背景計時持續運作。
- Windows 前景遊戲偵測，可自行選擇遊戲執行檔並在遊戲期間暫停倒數。
- SVG 圖示原稿與 `npm run icons`，產生 PNG、Windows ICO、macOS ICNS 與系統匣圖示。

### 改善與修正
- 設定頁改為分類導覽與響應式版面，顯示即時狀態、自動儲存成功／失敗提示。
- 重新設計休息畫面與應用程式圖示。
- 閒置偵測改為先暫停保留剩餘時間，再於持續閒置後重設；預設門檻為 2 分鐘加上額外 5 分鐘。
- 預警與主計時器同步，閒置或睡眠時關閉預警。
- 浮窗暫停後保留倒數，支援右鍵選單及失焦關閉選單。

### 發行平台
- 提供 Windows x64 NSIS 安裝程式，尚未簽章。
- macOS 仍需從原始碼於 macOS 自行建置，本次未提供或驗證 DMG。

### English
- Add an always-on-top countdown with saved position, snooze, immediate break, pause/resume, hide and tray restore.
- Add configurable foreground game pause on Windows.
- Redesign settings, break screens and icons; include SVG sources and a platform icon generator.
- Pause on idle before resetting after an additional idle delay; synchronize and dismiss prewarnings when idle or asleep.
- Ship an unsigned Windows x64 installer. macOS packaging remains a source-build option and was not validated for this release.
