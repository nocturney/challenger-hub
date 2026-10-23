'use strict';
/* Build native WinForms+WebView2 app + audited real Node backend in an isolated bundle. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..','..'),out=path.join(__dirname,'dist');
if(process.platform!=='win32')throw Error('Build Windows binaries on an authorized Windows machine');
const runtime=path.join(out,'runtime'),project=path.join(out,'windows','source'),
 publish=path.join(out,'windows','publish'),bundle=path.join(out,'windows','Challenger-Focus-Desktop-Preview4-Windows');
if(fs.existsSync(bundle)||fs.existsSync(project))throw Error('Refusing to overwrite versioned build');
const manifest=JSON.parse(fs.readFileSync(path.join(runtime,'desktop-manifest.json')));
if(manifest.version!=='4.0.0-desktop.preview.4'||!manifest.liveApi||manifest.screenshots<3)
 throw Error('Wrong desktop runtime manifest');
const one=(s,a,b,why)=>{if(s.split(a).length!==2)throw Error('Missing native anchor '+why);return s.replace(a,b)};
let cs=fs.readFileSync(path.join(root,'platform','windows','Program.cs'),'utf8');
if((cs.match(/17873/g)||[]).length!==2)throw Error('Unexpected native source port occurrences');
cs=cs.replaceAll('17873','17964');
cs=one(cs,'private const string LaunchScript = @"D:\\Velvet\\Installers\\CraftSuite\\Center\\Start-Center.ps1";',
 'private Process? ownedService;\n    private static string BundledRoot => System.IO.Path.Combine(AppContext.BaseDirectory,"runtime");\n'+
 '    private static string RuntimePath => System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),'+
 '"VelvetOS","ChallengerFocusDesktop","Preview4");',
 'launcher');
cs=cs.replaceAll('Craft Update Center','Challenger Focus Desktop');
cs=one(cs,'using System.Windows.Forms;','using System.Windows.Forms;\nusing System.Security.Principal;\nusing System.Security.Cryptography;', 'imports');
cs=one(cs,'app.GetString() == "Challenger Focus Desktop";',
 'app.GetString() == "Challenger Focus Desktop" &&\n'+
 '                   doc.RootElement.TryGetProperty("version",out var ver) && ver.GetString()=="4.0.0-desktop.preview.4" &&\n'+
 '                   doc.RootElement.TryGetProperty("admin",out var admin) && admin.GetBoolean()==IsAdministrator();',
 'strict live health');
const begin=cs.indexOf('    private static async Task RunStartupScript()'),end=cs.indexOf('    private async Task StartAsync',begin);
if(begin<0||end<begin)throw Error('Cannot locate original native startup method');
const startup=fs.readFileSync(path.join(__dirname,'windows-startup-snippet.cs.txt'),'utf8');
cs=cs.slice(0,begin)+startup+cs.slice(end);
cs=one(cs,'FormClosed += (_, _) => { client.Dispose(); view.Dispose(); };',
 'FormClosed += (_, _) => { try {if(ownedService is {HasExited:false}) ownedService.Kill(true);}catch{}'+
 ' ownedService?.Dispose();client.Dispose();view.Dispose(); };','lifetime');
cs=one(cs,'else if (data.TryGetProperty("type", out var operation) &&',
 'else if (data.TryGetProperty("type",out var elevateType) && elevateType.GetString()=="elevate-restart")\n'+
 '                    {\n'+
 '                        try {\n'+
 '                            if(!IsAdministrator()){\n'+
 '                                Process.Start(new ProcessStartInfo(Application.ExecutablePath){UseShellExecute=true,Verb="runas"});\n'+
 '                                BeginInvoke(new Action(Close));\n'+
 '                            }\n'+
 '                        } catch { /* UAC dismissed; keep the unprivileged UI open. */ }\n'+
 '                    }\n'+
 '                    else if (data.TryGetProperty("type", out var operation) &&',
 'UAC operation');
fs.mkdirSync(project,{recursive:true});
fs.writeFileSync(path.join(project,'Program.cs'),cs);
let csproj=fs.readFileSync(path.join(root,'platform','windows','CraftUpdateCenter.csproj'),'utf8');
csproj=csproj.replaceAll('CraftUpdateCenter','ChallengerFocusDesktopPreview4')
 .replaceAll('Craft Update Center','Challenger Focus Desktop Preview 4').replaceAll('2.4.0','4.0.0');
fs.writeFileSync(path.join(project,'ChallengerFocusDesktopPreview4.csproj'),csproj);
fs.copyFileSync(path.join(root,'brand','orbit','export','challenger-orbit.ico'),path.join(project,'icon.ico'));
const buildResult=cp.execFileSync('dotnet',['publish',path.join(project,'ChallengerFocusDesktopPreview4.csproj'),
 '-c','Release','-r','win-x64','--self-contained','true','-p:PublishSingleFile=true',
 '-p:IncludeNativeLibrariesForSelfExtract=true','-o',publish],{
 encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:240000,
 env:{...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1'}});
fs.mkdirSync(bundle,{recursive:true});
fs.cpSync(publish,bundle,{recursive:true});
fs.cpSync(runtime,path.join(bundle,'runtime'),{recursive:true});
fs.copyFileSync('C:/Program Files/nodejs/node.exe',path.join(bundle,'node.exe'));
fs.copyFileSync(path.join(__dirname,'NODE-LICENSE.txt'),path.join(bundle,'NODE-LICENSE.txt'));
const exe=path.join(bundle,'ChallengerFocusDesktopPreview4.exe');
if(!fs.existsSync(exe))throw Error('Self-contained native EXE missing after build');
const zip=path.join(out,'windows','Challenger-Focus-Desktop-Preview4-Windows.zip');
cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
 'Compress-Archive -LiteralPath \''+bundle.replace(/'/g,"''")+
 '\' -DestinationPath \''+zip.replace(/'/g,"''")+'\' -CompressionLevel Optimal'],{
 stdio:['ignore','pipe','pipe'],timeout:240000});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
console.log('CHALLENGER_FOCUS_NATIVE_WINDOWS_READY '+JSON.stringify({bundle,exe,zip,port:17964,
 bytes:fs.statSync(zip).size,sha256:sha(fs.readFileSync(zip)),
 webview:'WebView2',runtime:'bundled Node and self-contained .NET 10'}));
