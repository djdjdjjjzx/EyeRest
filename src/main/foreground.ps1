$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class EyeRestForeground {
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint id);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint id);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h, uint flags, StringBuilder name, ref uint size);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  public static string Path() {
    uint id; GetWindowThreadProcessId(GetForegroundWindow(), out id);
    IntPtr h = OpenProcess(0x1000, false, id);
    if (h == IntPtr.Zero) return "";
    try {
      uint size = 32768; var name = new StringBuilder((int)size);
      return QueryFullProcessImageName(h, 0, name, ref size) ? name.ToString() : "";
    } finally { CloseHandle(h); }
  }
}
'@
while ($true) {
  [Console]::WriteLine(([EyeRestForeground]::Path() | ConvertTo-Json -Compress))
  Start-Sleep -Milliseconds 500
}
