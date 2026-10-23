'use strict';
/* Focus Windows single-EXE: WinForms/WebView2 + verified Node + original Challenger engine.
   No installer, service registration, scheduled task, shell script or external Node dependency. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
if(process.platform!=='win32')throw Error('Build the Windows EXE on an authorized Windows host');
const root=path.resolve(__dirname,'..','..');
const dist=path.join(__dirname,'dist','onefile-preview8');
const project=path.join(dist,'source');
const payload=path.join(dist,'payload-stage');
const publish=path.join(dist,'publish');
const exeName='ChallengerFocusDesktopPreview8.exe';
const exe=path.join(publish,exeName);
const runtime=path.join(__dirname,'dist','runtime-preview8');
const sha=buf=>crypto.createHash('sha256').update(buf).digest('hex');
const one=(s,old,next,reason)=>{
 if(s.split(old).length!==2)throw Error('Source contract mismatch: '+reason);
 return s.replace(old,next);
};
const exec=(file,args,limit=240000)=>cp.execFileSync(file,args,{encoding:'utf8',
 stdio:['ignore','pipe','pipe'],timeout:limit,env:{...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1'}});
if(fs.existsSync(dist))throw Error('One-file Preview 8 output already exists; versioned builds are immutable.');
if(!fs.existsSync(runtime))exec(process.execPath,[path.join(__dirname,'build-runtime.cjs'),'8']);
const m=JSON.parse(fs.readFileSync(path.join(runtime,'desktop-manifest.json')));
if(m.version!=='4.0.0-desktop.preview.8'||m.liveApi!==true||m.screenshots!==3)
 throw Error('Wrong live runtime or non-audited screenshot set');
const hashes=JSON.parse(fs.readFileSync(path.join(runtime,'SHA256-MANIFEST.json')));
if(Object.keys(hashes).length<65)throw Error('Missing audited runtime files');
for(const [rel,expected] of Object.entries(hashes)){
 if(!/^[a-zA-Z0-9_.\/-]+$/.test(rel)||rel.includes('..'))throw Error('Untrusted path in manifest');
 const file=path.join(runtime,rel);
 if(sha(fs.readFileSync(file))!==expected)throw Error('SHA256 mismatch '+rel);
}
fs.mkdirSync(project,{recursive:true});
fs.cpSync(runtime,payload,{recursive:true});
fs.copyFileSync('C:/Program Files/nodejs/node.exe',path.join(payload,'node.exe'));
fs.copyFileSync(path.join(__dirname,'NODE-LICENSE.txt'),path.join(payload,'NODE-LICENSE.txt'));
const bundledHashes=JSON.parse(fs.readFileSync(path.join(payload,'SHA256-MANIFEST.json')));
for(const name of ['node.exe','NODE-LICENSE.txt'])bundledHashes[name]=sha(fs.readFileSync(path.join(payload,name)));
fs.writeFileSync(path.join(payload,'SHA256-MANIFEST.json'),JSON.stringify(bundledHashes,null,2));
const zip=path.join(project,'payload.zip');
const quote=s=>"'"+s.replace(/'/g,"''")+"'";
exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',
 "$ErrorActionPreference='Stop'; Compress-Archive -Path "+quote(path.join(payload,'*'))+
 " -DestinationPath "+quote(zip)+" -CompressionLevel Optimal"],240000);
if(!fs.existsSync(zip)||fs.statSync(zip).size<10_000_000)throw Error('Embedded Node package zip incomplete');

let cs=fs.readFileSync(path.join(root,'platform','windows','Program.cs'),'utf8');
cs=one(cs,'using System.Windows.Forms;',
 'using System.Windows.Forms;\nusing System.Security.Principal;\nusing System.Security.Cryptography;\n'+
 'using System.Net;\nusing System.Net.Sockets;\nusing System.IO.Compression;',
 'onefile imports');
cs=one(cs,
 '    private const string BaseUrl = "http://127.0.0.1:17873/";\n'+
 '    private const string LaunchScript = @"D:\\Velvet\\Installers\\CraftSuite\\Center\\Start-Center.ps1";',
 fs.readFileSync(path.join(__dirname,'windows-onefile-startup-preview8.cs.txt'),'utf8').trimEnd(),
 'single-file runtime integration');
cs=one(cs,'PINNED_RUNTIME_MANIFEST_SHA256',sha(fs.readFileSync(path.join(payload,'SHA256-MANIFEST.json'))).toUpperCase(),'pinned embedded payload integrity');
cs=one(cs,'using var res = await client.GetAsync(BaseUrl + "api/health");',
 'using var probe = new HttpRequestMessage(HttpMethod.Get, BaseUrl + "api/health");\n'+
 '            probe.Headers.TryAddWithoutValidation("X-Challenger-Desktop-Session", sessionToken);\n'+
 '            using var res = await client.SendAsync(probe);','session-specific health probe');
cs=one(cs,'app.GetString() == "Craft Update Center";',
 'app.GetString() == "Challenger Focus Desktop" &&\n'+
 '                   doc.RootElement.TryGetProperty("version",out var version) &&\n'+
 '                   version.GetString()=="4.0.0-desktop.preview.8" &&\n'+
 '                   doc.RootElement.TryGetProperty("desktopSessionVerified",out var session) &&\n'+
 '                   session.ValueKind==JsonValueKind.True;', 'reject foreign privileged service');
cs=one(cs,'Size = new Size(1400, 920);',
 'var usable = Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1280, 800);\n'+
 '        MinimumSize = new Size(720, 500);\n'+
 '        Size = new Size(Math.Min(1100, Math.Max(720, usable.Width - 40)),\n'+
 '                        Math.Min(760, Math.Max(500, usable.Height - 48)));\n'+
 '        WindowState = FormWindowState.Normal;',
 'SlicerBridge-style centered window fitted to Windows work area; never forced fullscreen');
const begin=cs.indexOf('    private static async Task RunStartupScript()');
const end=cs.indexOf('    private async Task StartAsync',begin);
if(begin<0||end<begin)throw Error('Original legacy startup block not found');
cs=cs.slice(0,begin)+cs.slice(end);
cs=one(cs,'for (var i = 0; i < 24; ++i)',
 'for (var i = 0; i < 48; ++i)','startup health timeout');
cs=one(cs,'if (!ready) throw new InvalidOperationException("The local service did not start. Check Start-Center.ps1.");',
 'if (!ready) throw new InvalidOperationException("Private engine did not become ready on port "+port+\n'+
 '                ". "+(ownedService is {HasExited:true}?"Node exited "+ownedService.ExitCode+". ":"")+\n'+
 '                "Diagnostic log: "+LogPath);','actionable diagnostics');
cs=one(cs,'"VelvetOS", "CraftUpdateCenter", "WebView2"',
 '"VelvetOS", "ChallengerFocusDesktop", "Preview8", "WebView2"','isolated browser profile');
cs=one(cs,'await view.EnsureCoreWebView2Async(environment);\n            var core = view.CoreWebView2;',
 'await view.EnsureCoreWebView2Async(environment);\n            var core = view.CoreWebView2;\n'+
 '            await core.AddScriptToExecuteOnDocumentCreatedAsync(\n'+
 '                "Object.defineProperty(window, \'CHALLENGER_DESKTOP_SESSION\', {value:"+\n'+
 '                JsonSerializer.Serialize(sessionToken)+",writable:false,configurable:false});");',
 'native desktop token to owned webview');
cs=one(cs,'view.Source = new Uri(BaseUrl);',
 'core.NavigationCompleted += (_,e)=>LogEngine("Desktop UI navigation: "+e.IsSuccess+" "+e.WebErrorStatus);\n'+
 '            LogEngine("Native WebView2 initialized; private session verified.");\n'+
 '            view.Source = new Uri(BaseUrl);','native visible UI readiness diagnostics');
cs=one(cs,'target.Port != 17873','target.Port != port','dynamic local-only navigation');
cs=one(cs,'FormClosed += (_, _) => { client.Dispose(); view.Dispose(); };',
 'FormClosed += (_, _) => {\n'+
 '            try { if(ownedService is {HasExited:false}) ownedService.Kill(entireProcessTree:true); }catch{}\n'+
 '            ownedService?.Dispose(); client.Dispose(); view.Dispose();\n'+
 '        };','own service lifecycle');
cs=one(cs,'else if (data.TryGetProperty("type", out var operation) &&',
 'else if (data.TryGetProperty("type",out var elevateType) && elevateType.GetString()=="elevate-restart")\n'+
 '                    {\n'+
 '                        try { if(!IsAdministrator()){\n'+
 '                            Process.Start(new ProcessStartInfo(Application.ExecutablePath)\n'+
 '                                {UseShellExecute=true,Verb="runas"});\n'+
 '                            BeginInvoke(new Action(Close));\n'+
 '                        }} catch { /* The user cancelled UAC. */ }\n'+
 '                    }\n'+
 '                    else if (data.TryGetProperty("type", out var operation) &&',
 'explicit UAC only');
cs=cs.replaceAll('Craft Update Center','Challenger Focus Desktop');
cs=one(cs,'status.Text = "Could not start Challenger Focus Desktop: " + ex.Message;',
 'LogEngine("Desktop startup failed: "+ex.GetType().Name+": "+ex.Message);\n'+
 '            status.Text = "Could not start Challenger Focus Desktop: " + ex.Message;',
 'actionable startup log');
cs=cs.replaceAll('CRAFT UPDATE CENTER','CHALLENGER FOCUS DESKTOP');
cs=cs.replaceAll('Starting the local update service','Starting private local engine');
if(cs.includes('Start-Center.ps1')||cs.includes('17873'))throw Error('Legacy production launcher/port leaked into new EXE');
fs.writeFileSync(path.join(project,'Program.cs'),cs);
let projectXml=fs.readFileSync(path.join(root,'platform','windows','CraftUpdateCenter.csproj'),'utf8');
projectXml=projectXml.replaceAll('CraftUpdateCenter','ChallengerFocusDesktopPreview8')
 .replaceAll('Craft Update Center','Challenger Focus Desktop Preview 8')
 .replaceAll('2.4.0','4.0.0');
projectXml=one(projectXml,'  <ItemGroup>\n    <PackageReference',
 '  <ItemGroup>\n    <EmbeddedResource Include="payload.zip" LogicalName="Challenger.Focus.EmbeddedPayload" />\n    <PackageReference',
 'single embedded verified Node/engine payload');
fs.writeFileSync(path.join(project,'ChallengerFocusDesktopPreview8.csproj'),projectXml);
fs.copyFileSync(path.join(root,'brand','orbit','export','challenger-orbit.ico'),path.join(project,'icon.ico'));
const buildOut=exec('dotnet',['publish',path.join(project,'ChallengerFocusDesktopPreview8.csproj'),
 '-c','Release','-r','win-x64','--self-contained','true','-p:PublishSingleFile=true',
 '-p:IncludeNativeLibrariesForSelfExtract=true','-p:EnableCompressionInSingleFile=true',
 '-p:PublishTrimmed=false','-p:DebugType=None','-o',publish],240000);
if(!fs.existsSync(exe))throw Error('Native single-file executable not produced');
const files=fs.readdirSync(publish).filter(x=>fs.statSync(path.join(publish,x)).isFile());
const requiredFiles=files.filter(x=>!x.toLowerCase().endsWith('.xml'));
if(requiredFiles.length!==1||requiredFiles[0]!==exeName)
 throw Error('Unexpected runtime sidecar dependency: '+files.join(', '));
fs.writeFileSync(path.join(dist,'build-evidence.json'),JSON.stringify({
 schema:'challenger-onefile-build.v1',version:m.version,executable:exeName,
 sha256:sha(fs.readFileSync(exe)),size:fs.statSync(exe).size,
 originalRuntimeFiles:Object.keys(hashes).length,
 embeddedPayloadSha256:sha(fs.readFileSync(zip)),
 includes:['original Challenger backend','Node v24','SHA256 integrity','Windows native WebView2 wrapper'],
 requires:['Windows with WebView2 Evergreen runtime'],
 port:'random loopback port per running native app',source:'feat/focus-desktop-onefile-preview8'
},null,2));
console.log('CHALLENGER_ONEFILE_WINDOWS_BUILT '+JSON.stringify({
 exe,bytes:fs.statSync(exe).size,sha256:sha(fs.readFileSync(exe)),
 runtimeFiles:Object.keys(hashes).length,standaloneFiles:files,packageBytes:fs.statSync(zip).size}));
