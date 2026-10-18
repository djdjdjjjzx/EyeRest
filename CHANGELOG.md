# 版本紀錄 / Changelog

## 0.3.1 — 2026-10-18

- 補上 Intel 與 Apple Silicon macOS DMG、獨立 Mac SHA256 校驗碼，以及可手動觸發的 GitHub Actions Mac 打包流程。Mac 版未使用 Developer ID 簽章或公證，未實測互動式安裝及圖形介面。
- Add Intel and Apple Silicon macOS DMGs, separate Mac SHA256 checksums and a manually dispatched GitHub Actions packaging workflow. Mac packages have no Developer ID signing or notarization; interactive installation and GUI behavior were not tested.
- 停用迷你倒數浮窗的背景節流，修正休息結束後仍顯示過期倒數的問題。
- 補上實際計時器、IPC 與預載橋接的整合測試，涵蓋一般／深度休息完成、提前結束，以及隱藏後恢復顯示的倒數更新。
- Disable background throttling for the mini timer to prevent stale countdowns after breaks.
- Cover normal, long and skipped break transitions through the real timer/IPC/preload path, including countdown updates while hidden and after restoring visibility.

## 0.3.0 — 2026-10-18

- 自訂休息背景：支援 PNG／JPG（最大 10 MB、3,200 萬像素），保存應用程式專用副本；可預覽、替換或恢復預設，一般／深度休息及三種提醒模式皆適用，讀取失敗時回復預設背景。
- 修正截圖後倒數浮窗消失，並補上浮窗恢復的回歸測試。
- 附上內建開始與結束提示音，支援獨立開關、各自音量與試聽。只有完整休息完成播放結束音，且多螢幕只播放一次。
- 統計時區可跟隨系統或指定 IANA 地區時區（含台北與 UTC），每日紀錄與圖表日期保持一致。
- 新紀錄儲存完成時間，可在切換時區後重新歸日；舊版總計保留原 UTC 日期，介面會說明此限制。
- Bundle start/completion chimes with independent toggles, independent volumes and previews. Play completion audio only for completed breaks, once across all monitors.
- Allow system or explicit IANA statistics time zones, with consistent dates in daily totals and charts. Timestamp new records for regrouping; preserve legacy UTC daily totals with a visible explanation.
- Add custom PNG/JPG break backgrounds with preview, reset, an application-owned copy, size limits and fallback across all reminder modes.
- Fix the mini timer disappearing after screenshots and cover recovery with regression checks.

### 發行平台
- Windows x64 未簽章 NSIS 安裝程式；本次未提供或驗證 macOS DMG。

## 0.2.1 — 2026-10-17

### 新增與改善
- 迷你浮窗平時淡化並略微縮小，滑鼠靠近及選單開啟時恢復完整外觀；可設定 15%～100% 平時不透明度，預設 35%。
- 浮窗快捷選單新增「設定」與「重新計時」。重新計時會清除工作進度、延長時間、跳過標記及手動暫停，從完整工作時間開始；若正在休息，會以未完成方式結束，不計入完成統計。遊戲與閒置等自動暫停條件仍適用。
- 「關閉通知（休息前預告）」勾選後會立即關閉現有預告並停用提前警告時間滑桿；正式休息提醒照常運作。
- 補上浮窗淡化、設定持久化、快捷選單與重新計時的回歸測試。

### English
- Fade and slightly shrink the mini timer while idle; restore full visibility near the pointer or while its menu is open. Persist idle opacity from 15% to 100%, defaulting to 35%.
- Add settings and restart actions to the mini timer menu. Restart clears progress, extensions, skip and manual pause, ends an active break without recording completion, and retains automatic pause conditions.
- Add a disable-prewarning control that dismisses existing prewarnings and disables the lead-time slider while keeping scheduled breaks enabled.
- Extend regression coverage for appearance, persistence, menu actions and timer restart.

### 發行平台
- Windows x64 未簽章 NSIS 安裝程式；本次未提供或驗證 macOS DMG。

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
