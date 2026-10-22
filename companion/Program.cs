using System.Diagnostics;
using System.Drawing;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;

namespace MoyuCompanion;

/// <summary>只為了接 WM_HOTKEY 的隱藏訊息視窗</summary>
sealed class HotkeyWindow : NativeWindow
{
    public event Action? Hotkey;
    public HotkeyWindow()
    {
        CreateHandle(new CreateParams { Caption = "MoyuHotkey", Style = 0 });
    }
    protected override void WndProc(ref Message m)
    {
        if (m.Msg == 0x0312 && m.WParam.ToInt32() == 1) Hotkey?.Invoke();
        base.WndProc(ref m);
    }
}

/// <summary>
/// 魔芋一夏 · 搭檔程式
/// 做兩件 Chrome 應用程式視窗自己做不到的事：
///   1. SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE) —— 截圖 / 錄影 / 分享螢幕都拍不到內容
///   2. 全域熱鍵 Alt+Q —— 通知本機服務切換老闆畫面
/// </summary>
static class Program
{
    // ── Win32 ────────────────────────────────────────────────
    const int WDA_NONE = 0x0;
    const int WDA_EXCLUDEFROMCAPTURE = 0x11;
    const int WM_HOTKEY = 0x0312;
    const uint MOD_ALT = 0x1, MOD_CONTROL = 0x2, MOD_SHIFT = 0x4, MOD_NOREPEAT = 0x4000;

    [DllImport("user32.dll")] static extern bool SetWindowDisplayAffinity(IntPtr hWnd, int dwAffinity);
    [DllImport("user32.dll")] static extern bool GetWindowDisplayAffinity(IntPtr hWnd, out int dwAffinity);
    [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr hWnd, int id);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, StringBuilder s, int n);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("kernel32.dll")] static extern bool AttachConsole(int pid);

    delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);

    // ── 狀態 ─────────────────────────────────────────────────
    static string titleFilter = "api-server";
    static int port = 47821;
    static uint hotkeyVk = 0x51;            // 'Q'
    static uint hotkeyMods = MOD_ALT | MOD_NOREPEAT;
    static IntPtr target = IntPtr.Zero;
    static IntPtr hotkeyHost = IntPtr.Zero;
    static bool protect = true;
    static readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(3) };

    static string logPath = "";

    static void Log(string s)
    {
        Console.WriteLine(s);
        try
        {
            var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MoyuCompanion");
            if (logPath.Length > 0)
            {
                var d2 = Path.GetDirectoryName(logPath);
                if (d2 != null) Directory.CreateDirectory(d2);
                File.AppendAllText(logPath, s + Environment.NewLine);
                return;
            }
            Directory.CreateDirectory(dir);
            File.AppendAllText(Path.Combine(dir, "companion.log"),
                $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {s}{Environment.NewLine}");
        }
        catch { }
    }

    // ── 找視窗 ───────────────────────────────────────────────
    static IntPtr FindTarget()
    {
        IntPtr found = IntPtr.Zero;
        EnumWindows((h, _) =>
        {
            if (!IsWindowVisible(h)) return true;
            var len = GetWindowTextLength(h);
            if (len <= 0) return true;
            var sb = new StringBuilder(len + 2);
            GetWindowText(h, sb, sb.Capacity);
            var t = sb.ToString();
            if (t.Contains(titleFilter, StringComparison.OrdinalIgnoreCase))
            {
                found = h;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }

    static void ApplyProtection()
    {
        if (!protect) return;
        if (target == IntPtr.Zero || !IsWindowVisible(target)) target = FindTarget();
        if (target == IntPtr.Zero) return;
        if (!SetWindowDisplayAffinity(target, WDA_EXCLUDEFROMCAPTURE))
            Log("SetWindowDisplayAffinity 失敗：" + Marshal.GetLastWin32Error());
    }

    static bool IsProtected(out int aff)
    {
        aff = -1;
        if (target == IntPtr.Zero) return false;
        return GetWindowDisplayAffinity(target, out aff) && aff == WDA_EXCLUDEFROMCAPTURE;
    }

    // ── 老闆鍵 ───────────────────────────────────────────────
    static async void ToggleBoss()
    {
        try
        {
            using var content = new StringContent("{}", Encoding.UTF8, "application/json");
            var r = await http.PostAsync($"http://127.0.0.1:{port}/api/boss", content);
            var body = await r.Content.ReadAsStringAsync();
            Log("老闆鍵 → " + body);
        }
        catch (Exception e)
        {
            Log("老闆鍵失敗：" + e.Message);
        }
    }

    // ── 自測（不需要 GUI 互動）──────────────────────────────
    static int SelfTest()
    {
        Log("=== 自測 ===");

        // 建一個隱藏視窗，驗證 WDA 真的生效
        using var f = new Form { Text = "moyu-selftest", Width = 200, Height = 120, ShowInTaskbar = false };
        f.Show();
        var h = f.Handle;

        var ok = SetWindowDisplayAffinity(h, WDA_EXCLUDEFROMCAPTURE);
        var err = Marshal.GetLastWin32Error();
        var got = GetWindowDisplayAffinity(h, out var aff) && aff == WDA_EXCLUDEFROMCAPTURE;
        Log($"  SetWindowDisplayAffinity: {(ok ? "成功" : "失敗 err=" + err)}");
        Log($"  GetWindowDisplayAffinity: {(got ? "已排除截圖 ✅" : "未生效 ❌")}");

        // 熱鍵
        // 熱鍵：被佔用就往後退
        var combos = new (uint mods, uint vk, string name)[]
        {
            (hotkeyMods, hotkeyVk, "Alt+Q"),
            (MOD_CONTROL | MOD_ALT | MOD_NOREPEAT, hotkeyVk, "Ctrl+Alt+Q"),
            (MOD_ALT | MOD_SHIFT | MOD_NOREPEAT, hotkeyVk, "Alt+Shift+Q"),
        };
        var reg = false;
        foreach (var c in combos)
        {
            reg = RegisterHotKey(IntPtr.Zero, 1, c.mods, c.vk);
            if (reg) { Log($"  RegisterHotKey({c.name}): 成功 ✅"); break; }
            Log($"  RegisterHotKey({c.name}): 失敗 err={Marshal.GetLastWin32Error()}");
        }
        if (reg) UnregisterHotKey(IntPtr.Zero, 1);

        // 連線本機服務
        try
        {
            var r = http.GetAsync($"http://127.0.0.1:{port}/api/health").GetAwaiter().GetResult();
            Log($"  本機服務: HTTP {(int)r.StatusCode}");
        }
        catch (Exception e) { Log("  本機服務: 連不上（" + e.Message + "）"); }

        f.Close();
        Log("=== 自測結束 ===");
        return ok && got && reg ? 0 : 1;
    }

    // ── 主程式 ───────────────────────────────────────────────
    [STAThread]
    static int Main(string[] args)
    {
        bool selfTest = args.Contains("--self-test");
        if (selfTest) AttachConsole(-1);

        foreach (var a in args)
        {
            if (a.StartsWith("--title=")) titleFilter = a[8..];
            else if (a.StartsWith("--port=")) int.TryParse(a[7..], out port);
            else if (a.StartsWith("--log=")) logPath = a[6..];
            else if (a.StartsWith("--hotkey=") && a[9..].Equals("Ctrl+Q", StringComparison.OrdinalIgnoreCase))
            { hotkeyMods = MOD_CONTROL | MOD_NOREPEAT; }
            else if (a == "--no-protect") protect = false;
        }

        if (selfTest) return SelfTest();

        ApplicationConfiguration.Initialize();

        // 隱藏的訊息視窗：接全域熱鍵
        var hw = new HotkeyWindow();
        hw.Hotkey += ToggleBoss;
        hotkeyHost = hw.Handle;

        if (!RegisterHotKey(hotkeyHost, 1, hotkeyMods, hotkeyVk))
            Log("全域熱鍵註冊失敗（可能被別的程式佔用）");
        else
            Log("全域熱鍵 Alt+Q 已註冊");

        // 托盤
        var menu = new ContextMenuStrip();
        menu.Items.Add("顯示視窗", null, (_, _) =>
        {
            target = FindTarget();
            if (target != IntPtr.Zero) { ShowWindow(target, 9); SetForegroundWindow(target); }
        });
        var protItem = new ToolStripMenuItem("防截圖", null, (_, _) =>
        {
            protect = !protect;
            if (!protect && target != IntPtr.Zero) SetWindowDisplayAffinity(target, WDA_NONE);
            else ApplyProtection();
        }) { Checked = protect, CheckOnClick = true };
        menu.Items.Add(protItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("結束", null, (_, _) => Application.Exit());

        var icon = SystemIcons.Shield;
        var tray = new NotifyIcon
        {
            Icon = icon,
            Text = "魔芋一夏 · 搭檔",
            Visible = true,
            ContextMenuStrip = menu,
        };
        tray.DoubleClick += (_, _) =>
        {
            target = FindTarget();
            if (target != IntPtr.Zero) { ShowWindow(target, 9); SetForegroundWindow(target); }
        };

        // 定期重新套用防截圖（Chrome 換視窗時會掉）
        var timer = new System.Windows.Forms.Timer { Interval = 3000 };
        timer.Tick += (_, _) => ApplyProtection();
        timer.Start();

        Log("搭檔已啟動");
        Application.Run(new ApplicationContext());
        UnregisterHotKey(hotkeyHost, 1);
        tray.Visible = false;
        return 0;
    }
}
