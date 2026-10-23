'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..','..'),build=path.join(__dirname,'dist');
if(process.platform!=='darwin')throw Error('Build macOS .app on an authorized Mac');
const runtime=path.join(build,'runtime'),name='Challenger Focus Desktop Preview 4.app';
const app=path.join(build,'mac',name);
if(fs.existsSync(app))throw Error('Refusing to overwrite existing .app preview build');
if(!fs.existsSync(path.join(runtime,'desktop-manifest.json')))throw Error('Build verified desktop runtime first');
const manifest=JSON.parse(fs.readFileSync(path.join(runtime,'desktop-manifest.json')));
if(manifest.version!=='4.0.0-desktop.preview.4'||!manifest.liveApi||manifest.screenshots<3)
 throw Error('Desktop live manifest mismatch');
const one=(text,find,to,reason)=>{if(text.split(find).length!==2)throw Error('Native Swift anchor missing: '+reason);return text.replace(find,to)};
let swift=fs.readFileSync(path.join(root,'platform','macos','main.swift'),'utf8');
if((swift.match(/17873/g)||[]).length!==3)throw Error('Native endpoint anchor mismatch');
swift=swift.replaceAll('17873','17964');

swift=one(swift,
 'private let root = "/Users/chris/Library/Application Support/OfficeOps/CraftSuite/Center"\nprivate let launcher = root + "/Start-Center.sh"',
 'private let bundleRuntime = Bundle.main.resourceURL!.appendingPathComponent("runtime")\n'+
 'private let bundledNode = Bundle.main.resourceURL!.appendingPathComponent("node")\n'+
 'private let liveData = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/VelvetOS/ChallengerFocusDesktop/Preview4")\n'+
 'private let legacyRoot = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/OfficeOps/CraftSuite/Center")',
 'isolated desktop runtime');
swift=one(swift,'private var startupFinished = false',
 'private var startupFinished = false\n    private var ownedService: Process?','owned server');
swift=one(swift,'func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }',
 'func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }\n'+
 '    func applicationWillTerminate(_ notification: Notification) {\n'+
 '        if let p = ownedService, p.isRunning { p.terminate() }\n'+
 '    }','owned server cleanup');
swift=one(swift,'(obj["app"] as? String) == "Craft Update Center"',
 '(obj["app"] as? String) == "Challenger Focus Desktop" && (obj["version"] as? String) == "4.0.0-desktop.preview.4"',
 'strict desktop backend health');
const start=swift.indexOf('            if !ready {'),end=swift.indexOf('            for _ in 0..<28 {',start);
if(start<0||end<start)throw Error('Native process launch block unavailable');
const startup=[
 '            if !ready {',
 '                do {',
 '                    let fm = FileManager.default',
 '                    if !fm.fileExists(atPath: liveData.path) {',
 '                        try fm.createDirectory(at: liveData.deletingLastPathComponent(), withIntermediateDirectories: true)',
 '                        try fm.copyItem(at: bundleRuntime, to: liveData)',
 '                    }',
 '                    for name in ["catalog-cache.json", "source-signals.json", "managed-installs.json"] {',
 '                        let from = legacyRoot.appendingPathComponent(name)',
 '                        let to = liveData.appendingPathComponent(name)',
 '                        if fm.fileExists(atPath: from.path) && !fm.fileExists(atPath: to.path) {',
 '                            try fm.copyItem(at: from, to: to)',
 '                        }',
 '                    }',
 '                    let p = Process()',
 '                    p.executableURL = bundledNode',
 '                    p.arguments = [liveData.appendingPathComponent("server.js").path]',
 '                    p.currentDirectoryURL = liveData',
 '                    var env = ProcessInfo.processInfo.environment',
 '                    env["CRAFT_CENTER_PORT"] = "17964"',
 '                    env.removeValue(forKey: "CHALLENGER_DISABLE_SCAN")',
 '                    p.environment = env',
 '                    let log = liveData.appendingPathComponent("desktop-service.log")',
 '                    if !fm.fileExists(atPath: log.path) { _ = fm.createFile(atPath: log.path, contents: nil) }',
 '                    let output = try FileHandle(forWritingTo: log)',
 '                    output.seekToEndOfFile()',
 '                    p.standardOutput = output',
 '                    p.standardError = output',
 '                    try p.run()',
 '                    self.ownedService = p',
 '                } catch {',
 '                    let message = error.localizedDescription',
 '                    DispatchQueue.main.async { [weak self] in self?.showError(message) }',
 '                    return',
 '                }',
 '            }',''
].join('\n');
swift=swift.slice(0,start)+startup+swift.slice(end);
swift=swift.replaceAll('Craft Update Center','Challenger Focus Desktop');
swift=swift.replaceAll('Version 2.4.0','Version 4.0.0 Desktop Preview 4');
const handler=[
 '    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,',
 '                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {',
 '        let alert = NSAlert()',
 '        alert.messageText = "Confirm Challenger action"',
 '        alert.informativeText = message',
 '        alert.alertStyle = .warning',
 '        alert.addButton(withTitle: "Continue")',
 '        alert.addButton(withTitle: "Cancel")',
 '        completionHandler(alert.runModal() == .alertFirstButtonReturn)',
 '    }','',''
].join('\n');
swift=one(swift,'    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {',
 handler+'    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {',
 'native action confirmation');
let plist=fs.readFileSync(path.join(root,'platform','macos','Info.plist'),'utf8');
for(const [a,b] of [
 ['Craft Update Center','Challenger Focus Desktop Preview 4'],
 ['CraftUpdateCenter','ChallengerFocusDesktop'],
 ['io.velvetos.community.craftupdatecenter','io.velvetos.community.challengerfocus.preview4'],
 ['<string>2.4.0</string>','<string>4.0.0</string>'],
 ['<string>240</string>','<string>4004</string>']]){
 if(!plist.includes(a))throw Error('Plist marker missing: '+a);plist=plist.replaceAll(a,b);
}
const contents=path.join(app,'Contents');
fs.mkdirSync(path.join(contents,'MacOS'),{recursive:true});
fs.mkdirSync(path.join(contents,'Resources'),{recursive:true});
const swiftFile=path.join(build,'mac','ChallengerFocusDesktop.swift');
fs.writeFileSync(swiftFile,swift);fs.writeFileSync(path.join(contents,'Info.plist'),plist);
const executable=path.join(contents,'MacOS','ChallengerFocusDesktop');
const run=(file,args)=>cp.execFileSync(file,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:180000});
run('/usr/bin/swiftc',['-O',swiftFile,'-o',executable,'-framework','AppKit','-framework','WebKit']);
fs.copyFileSync('/usr/local/bin/node',path.join(contents,'Resources','node'));
fs.copyFileSync(path.join(__dirname,'NODE-LICENSE-macOS.txt'),path.join(contents,'Resources','NODE-LICENSE.txt'));
fs.chmodSync(path.join(contents,'Resources','node'),0o755);
fs.cpSync(runtime,path.join(contents,'Resources','runtime'),{recursive:true});
fs.copyFileSync(path.join(root,'brand','orbit','export','challenger-orbit.icns'),path.join(contents,'Resources','AppIcon.icns'));
run('/usr/bin/codesign',['--force','--deep','--sign','-',app]);
run('/usr/bin/codesign',['--verify','--deep','--strict',app]);
const dmg=path.join(build,'mac','Challenger-Focus-Desktop-Preview4-macOS.dmg');
if(fs.existsSync(dmg))throw Error('DMG already exists; never silently overwrite a release archive');
run('/usr/bin/hdiutil',['create','-volname','Challenger Focus Desktop Preview 4',
 '-srcfolder',app,'-format','UDZO',dmg]);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
console.log('CHALLENGER_FOCUS_NATIVE_MAC_READY '+JSON.stringify({
 app,dmg,sha256:hash(fs.readFileSync(dmg)),dmgBytes:fs.statSync(dmg).size,
 backend:'LIVE_LOCAL_PREVIEW',codeSign:'ad-hoc; not notarized',port:17964
}));
