const { spawn } = require('child_process');
const path = require('path');

function normalizeGamePath(value) {
  return typeof value === 'string' && path.win32.isAbsolute(value) && /\.exe$/i.test(value)
    ? path.win32.normalize(value).toLowerCase() : '';
}

class GameMonitor {
  constructor(onChange) {
    this.onChange = onChange;
    this.child = null;
    this.games = [];
    this.foreground = '';
    this.error = false;
  }
  configure(settings) {
    this.games = settings.gamePauseEnabled ? (settings.gamePaths || []).map(normalizeGamePath).filter(Boolean) : [];
    if (process.platform !== 'win32' || !this.games.length) {
      this.stop();
      return;
    }
    this.publish();
    if (this.child) return;
    this.error = false;
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'foreground.ps1')], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    this.child = child;
    let buffer = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data) => {
      buffer += data;
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        try { this.foreground = normalizeGamePath(JSON.parse(line)); this.publish(); } catch (_) { /* Ignore incomplete diagnostic lines. */ }
      }
    });
    child.stderr.on('data', () => {});
    const failed = () => {
      if (this.child !== child) return;
      this.child = null;
      this.foreground = '';
      this.error = true;
      this.publish();
      child.kill();
    };
    child.on('error', failed);
    child.on('exit', failed);
  }
  publish() {
    this.onChange(this.games.includes(this.foreground) ? path.win32.basename(this.foreground) : '', this.error);
  }
  stop() {
    const child = this.child;
    this.child = null;
    if (child) child.kill();
    this.foreground = '';
    this.error = false;
    this.publish();
  }
}
module.exports = { GameMonitor, normalizeGamePath };
