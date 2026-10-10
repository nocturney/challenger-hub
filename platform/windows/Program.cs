using System;
using System.Diagnostics;
using System.Drawing;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace CraftUpdateCenter;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new CenterWindow());
    }
}

internal sealed class CenterWindow : Form
{
    private const string BaseUrl = "http://127.0.0.1:17873/";
    private const string LaunchScript = @"D:\Velvet\Installers\CraftSuite\Center\Start-Center.ps1";
    private readonly HttpClient client = new() { Timeout = TimeSpan.FromSeconds(2) };
    private readonly WebView2 view = new() { Dock = DockStyle.Fill };
    private readonly Panel placeholder = new() { Dock = DockStyle.Fill, BackColor = Color.FromArgb(11, 16, 23) };
    private bool busy;

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int valueSize);

    private void ApplyNativeTheme(string value)
    {
        var dark = value == "dark" ? 1 : 0;
        try { DwmSetWindowAttribute(Handle, 20, ref dark, sizeof(int)); }
        catch { /* OS title-bar styling is optional. */ }
        BackColor = dark == 1 ? Color.FromArgb(11, 17, 24) : Color.FromArgb(243, 246, 246);
    }

    private static (bool ok, string error) LaunchInstalledApp(string repo)
    {
        if (string.IsNullOrWhiteSpace(repo) ||
            !System.Text.RegularExpressions.Regex.IsMatch(repo, @"^[a-z][a-z0-9-]{1,79}$",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase))
            return (false, "Invalid application identifier");

        try
        {
            var roots = new[] {
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86)
            };
            foreach (var root in roots)
            {
                if (string.IsNullOrEmpty(root) || !System.IO.Directory.Exists(root)) continue;
                foreach (var directory in System.IO.Directory.EnumerateDirectories(root))
                {
                    var folderName = System.IO.Path.GetFileName(directory);
                    var normalized = new string(folderName.Where(char.IsLetterOrDigit).ToArray());
                    if (!string.Equals(normalized, repo, StringComparison.OrdinalIgnoreCase))
                        continue;
                    var program = System.IO.Path.Combine(directory, repo + ".exe");
                    if (!System.IO.File.Exists(program)) continue;
                    Process.Start(new ProcessStartInfo {
                        FileName = program, WorkingDirectory = directory,
                        UseShellExecute = true, WindowStyle = ProcessWindowStyle.Normal
                    });
                    return (true, "");
                }
            }
            const string manifest = @"D:\Velvet\Installers\CraftSuite\Center\managed-installs.json";
            const string managedRoot = @"D:\Velvet\Installers\ChallengerHub\Managed";
            if (System.IO.File.Exists(manifest))
            {
                using var document = JsonDocument.Parse(System.IO.File.ReadAllText(manifest));
                if (document.RootElement.TryGetProperty("installed", out var installed) &&
                    installed.TryGetProperty(repo, out var record) &&
                    record.TryGetProperty("installedPath", out var fileValue))
                {
                    var candidate = fileValue.GetString() ?? "";
                    var expected = System.IO.Path.GetFullPath(
                        System.IO.Path.Combine(managedRoot, repo)) +
                        System.IO.Path.DirectorySeparatorChar;
                    var full = System.IO.Path.GetFullPath(candidate);
                    if (!full.StartsWith(expected, StringComparison.OrdinalIgnoreCase) ||
                        !full.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                        return (false, "Managed application path was rejected");
                    if (!System.IO.File.Exists(full))
                        return (false, "Tracked executable was not found");
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = full,
                        WorkingDirectory = System.IO.Path.GetDirectoryName(full) ?? expected,
                        UseShellExecute = true,
                        WindowStyle = ProcessWindowStyle.Normal
                    });
                    return (true, "");
                }
            }
            return (false, "Installed application executable was not found");
        }
        catch (Exception ex) { return (false, ex.Message); }
    }

    public CenterWindow()
    {
        Text = "Craft Update Center";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(680, 540);
        Size = new Size(1400, 920);
        BackColor = Color.FromArgb(11, 16, 23);
        ForeColor = Color.White;
        FormBorderStyle = FormBorderStyle.Sizable;
        ShowIcon = true;
        AutoScaleMode = AutoScaleMode.Dpi;
        try
        {
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application;
        }
        catch
        {
            Icon = SystemIcons.Application;
        }
        var title = new Label
        {
            Text = "CRAFT UPDATE CENTER",
            Font = new Font("Segoe UI", 21, FontStyle.Bold),
            ForeColor = Color.FromArgb(122, 185, 253),
            AutoSize = false, Height = 52, Dock = DockStyle.Top,
            TextAlign = ContentAlignment.MiddleCenter
        };
        var status = new Label
        {
            Text = "Starting the local update service...",
            Font = new Font("Segoe UI", 12),
            ForeColor = Color.FromArgb(162, 179, 192),
            Dock = DockStyle.Top, Height = 38,
            TextAlign = ContentAlignment.MiddleCenter
        };
        var retry = new Button
        {
            Text = "Try again",
            Dock = DockStyle.Bottom,
            Height = 40,
            Width = 170,
            Visible = false,
            FlatStyle = FlatStyle.Flat,
            ForeColor = Color.FromArgb(11, 16, 23),
            BackColor = Color.FromArgb(81, 158, 255)
        };
        retry.Click += async (_, _) => await StartAsync(status, retry);
        var container = new Panel { Dock = DockStyle.Fill, Padding = new Padding(40, 160, 40, 150) };
        container.Controls.Add(status);
        container.Controls.Add(title);
        container.Controls.Add(retry);
        placeholder.Controls.Add(container);
        Controls.Add(placeholder);
        Controls.Add(view);
        view.Visible = false;
        Shown += async (_, _) => await StartAsync(status, retry);
        FormClosed += (_, _) => { client.Dispose(); view.Dispose(); };
    }

    private async Task<bool> Ready()
    {
        try
        {
            using var res = await client.GetAsync(BaseUrl + "api/health");
            if (!res.IsSuccessStatusCode) return false;
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
            return doc.RootElement.TryGetProperty("app", out var app) &&
                   app.GetString() == "Craft Update Center";
        }
        catch
        {
            return false;
        }
    }

    private static async Task RunStartupScript()
    {
        if (!System.IO.File.Exists(LaunchScript))
            throw new InvalidOperationException("Missing local service launcher: " + LaunchScript);
        var args = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + LaunchScript + "\"";
        using var p = Process.Start(new ProcessStartInfo
        {
            FileName = "powershell.exe", Arguments = args,
            UseShellExecute = false, CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        }) ?? throw new InvalidOperationException("Could not start service launcher");
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(60));
        try { await p.WaitForExitAsync(cts.Token); }
        catch (OperationCanceledException) { /* The health probe will report the actual state. */ }
    }

    private async Task StartAsync(Label status, Button retry)
    {
        if (busy) return;
        busy = true;
        retry.Visible = false;
        status.Text = "Checking the local Craft service...";
        try
        {
            if (!await Ready())
            {
                status.Text = "Starting the secure local service...";
                await RunStartupScript();
            }
            var ready = false;
            for (var i = 0; i < 24; ++i)
            {
                if (await Ready()) { ready = true; break; }
                await Task.Delay(250);
            }
            if (!ready) throw new InvalidOperationException("The local service did not start. Check Start-Center.ps1.");

            var profileDirectory = System.IO.Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "VelvetOS", "CraftUpdateCenter", "WebView2");
            System.IO.Directory.CreateDirectory(profileDirectory);
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: profileDirectory);
            await view.EnsureCoreWebView2Async(environment);
            var core = view.CoreWebView2;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsZoomControlEnabled = true;
            core.WebMessageReceived += (_, e) =>
            {
                try
                {
                    using var message = JsonDocument.Parse(e.WebMessageAsJson);
                    var data = message.RootElement;
                    if (data.TryGetProperty("type", out var type) && type.GetString() == "theme" &&
                        data.TryGetProperty("value", out var value) &&
                        (value.GetString() == "light" || value.GetString() == "dark"))
                    {
                        var selected = value.GetString()!;
                        BeginInvoke(new Action(() => ApplyNativeTheme(selected)));
                    }
                    else if (data.TryGetProperty("type", out var operation) &&
                             operation.GetString() == "launch" &&
                             data.TryGetProperty("repo", out var repoProperty))
                    {
                        var repo = repoProperty.GetString() ?? "";
                        var (ok, error) = LaunchInstalledApp(repo);
                        core.PostWebMessageAsJson(JsonSerializer.Serialize(new {
                            type = "launch-result", repo, ok, error
                        }));
                    }
                }
                catch { /* Ignore unsupported WebView2 messages. */ }
            };
            core.NavigationStarting += (_, e) =>
            {
                if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var target) ||
                    target.Scheme != Uri.UriSchemeHttp ||
                    target.Host != "127.0.0.1" || target.Port != 17873)
                    e.Cancel = true;
            };
            core.NewWindowRequested += (_, e) =>
            {
                e.Handled = true;
                if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) &&
                    uri.Scheme == Uri.UriSchemeHttps &&
                    (uri.Host == "github.com" || uri.Host.EndsWith(".github.com", StringComparison.OrdinalIgnoreCase)))
                {
                    try { Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true }); }
                    catch { /* External browser unavailable; do not navigate internally. */ }
                }
            };
            core.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;
            view.Source = new Uri(BaseUrl);
            placeholder.Visible = false;
            view.Visible = true;
            view.BringToFront();
        }
        catch (Exception ex)
        {
            status.Text = "Could not start Craft Update Center: " + ex.Message;
            placeholder.Visible = true;
            view.Visible = false;
            retry.Visible = true;
        }
        finally { busy = false; }
    }
}