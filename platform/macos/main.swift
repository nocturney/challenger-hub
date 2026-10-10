import AppKit
import WebKit
import Foundation

private let centerURL = URL(string: "http://127.0.0.1:17873/")!
private let healthURL = URL(string: "http://127.0.0.1:17873/api/health")!
private let root = "/Users/chris/Library/Application Support/OfficeOps/CraftSuite/Center"
private let launcher = root + "/Start-Center.sh"

final class CenterDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private var window: NSWindow?
    private var webView: WKWebView?
    private var startupFinished = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.appearance = nil
        installMenus()
        createWindow()
        NSApp.activate(ignoringOtherApps: true)
        beginStartup()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    private func installMenus() {
        let menu = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Craft Update Center", action: #selector(showAbout), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Craft Update Center", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        menu.addItem(appItem)
        let viewItem = NSMenuItem()
        let viewMenu = NSMenu(title: "View")
        viewMenu.addItem(withTitle: "Reload", action: #selector(reloadPage), keyEquivalent: "r")
        viewItem.submenu = viewMenu
        menu.addItem(viewItem)
        NSApp.mainMenu = menu
    }

    @objc private func showAbout() {
        let alert = NSAlert()
        alert.messageText = "Craft Update Center"
        alert.informativeText = "Version 2.4.0\nLocal native macOS wrapper (WKWebView) for Storytold Craft release management.\nUnofficial community utility for VelvetOS."
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

    @objc private func reloadPage() { webView?.reload() }

    private func createWindow() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        config.userContentController.add(self, name: "craftTheme")
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = false

        let visible = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let width = min(1380.0, max(720.0, visible.width - 70.0))
        let height = min(910.0, max(620.0, visible.height - 70.0))
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: width, height: height),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false
        )
        window.title = "Craft Update Center"
        window.minSize = NSSize(width: 700, height: 540)
        window.contentView = web
        window.center()
        window.isReleasedWhenClosed = false
        window.makeKeyAndOrderFront(nil)
        self.window = window
        self.webView = web
        showLoading()
    }

    private func showLoading() {
        let html = """
        <!DOCTYPE html><html lang="he" dir="rtl"><meta charset="utf-8">
        <style>body{display:grid;place-items:center;height:100vh;margin:0;background:#0a0e15;color:#e1f4ed;font:16px -apple-system,Arial}
        .box{text-align:center}.brand{font-size:25px;font-weight:800;letter-spacing:.05em;color:#7ab9ff}p{color:#a6b9cf;margin-top:20px}</style>
        <div class="box"><div class="brand">CHALLENGER HUB</div><p>Starting the local service…</p></div>
        </html>
        """
        webView?.loadHTMLString(html, baseURL: centerURL)
    }

    private func isHealthy() -> Bool {
        guard let data = try? Data(contentsOf: healthURL) else { return false }
        guard let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return false }
        return (obj["app"] as? String) == "Craft Update Center"
    }

    private func beginStartup() {
        guard !startupFinished else { return }
        startupFinished = true
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self else { return }
            var ready = self.isHealthy()
            if !ready {
                do {
                    guard FileManager.default.fileExists(atPath: launcher) else {
                        throw NSError(domain: "CraftUpdateCenter", code: 1, userInfo: [NSLocalizedDescriptionKey: "Local service launcher was not found"])
                    }
                    let p = Process()
                    p.executableURL = URL(fileURLWithPath: "/bin/bash")
                    p.arguments = [launcher]
                    var env = ProcessInfo.processInfo.environment
                    env["CRAFT_NO_BROWSER"] = "1"
                    p.environment = env
                    p.standardOutput = Pipe()
                    p.standardError = Pipe()
                    try p.run()
                    p.waitUntilExit()
                    if p.terminationStatus != 0 {
                        throw NSError(domain: "CraftUpdateCenter", code: Int(p.terminationStatus), userInfo: [NSLocalizedDescriptionKey: "The local service failed to start"])
                    }
                } catch {
                    let message = error.localizedDescription
                    DispatchQueue.main.async { [weak self] in self?.showError(message) }
                    return
                }
            }
            for _ in 0..<28 {
                if self.isHealthy() { ready = true; break }
                Thread.sleep(forTimeInterval: 0.3)
            }
            DispatchQueue.main.async { [weak self] in
                if ready { self?.webView?.load(URLRequest(url: centerURL)) }
                else { self?.showError("The local service at 127.0.0.1 is unreachable. Check the service log.") }
            }
        }
    }

    private func showError(_ message: String) {
        let escaped = message
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
        let html = """
        <!DOCTYPE html><html lang="he" dir="rtl"><meta charset="utf-8">
        <style>body{display:grid;place-items:center;height:100vh;margin:0;background:#0a0e15;color:#dceee6;font:16px -apple-system,Arial}
        .box{text-align:center;max-width:560px;padding:30px}strong{color:#ff9aad}p{color:#a7bcd6;line-height:1.8}</style>
        <div class="box"><strong>Could not open Craft Update Center</strong><p>\(escaped)</p><p>Close and reopen the app to retry.</p></div>
        </html>
        """
        webView?.loadHTMLString(html, baseURL: centerURL)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "craftTheme", let value = message.body as? String,
              value == "light" || value == "dark" else { return }
        let appearance = NSAppearance(named: value == "dark" ? .darkAqua : .aqua)
        DispatchQueue.main.async { [weak self] in self?.window?.appearance = appearance }
    }

    private func external(_ url: URL?) -> Bool {
        guard let url, url.scheme == "https" else { return false }
        let host = url.host?.lowercased() ?? ""
        guard host == "github.com" || host.hasSuffix(".github.com") else { return false }
        NSWorkspace.shared.open(url)
        return true
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "about" { decisionHandler(.allow); return }
        if url.host == "127.0.0.1" && url.port == 17873 && url.scheme == "http" {
            decisionHandler(.allow)
            return
        }
        if navigationAction.navigationType == .linkActivated { _ = external(url) }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        _ = external(navigationAction.request.url)
        return nil
    }
}

let delegate = CenterDelegate()
let application = NSApplication.shared
application.delegate = delegate
application.run()