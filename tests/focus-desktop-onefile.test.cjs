'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),desktop=path.join(root,'tools','desktop-build');
const read=n=>fs.readFileSync(path.join(desktop,n),'utf8');

test('single EXE bundles signed-by-hash original Node/backend payload, no extra runtime installers',()=>{
 const b=read('build-onefile-windows.cjs');
 for(const s of ['EmbeddedResource','payload.zip','node.exe','SHA256-MANIFEST.json',
  'PINNED_RUNTIME_MANIFEST_SHA256','PublishSingleFile=true','--self-contained','IncludeNativeLibrariesForSelfExtract=true',
  'EnableCompressionInSingleFile=true','ChallengerFocusDesktopPreview5.exe'])
  assert.ok(b.includes(s),s);
 assert.ok(b.includes("bundledHashes[name]"),'Node bytes must be included in manifest');
 assert.ok(b.includes("if(fs.existsSync(dist))throw"),'Builds must not silently overwrite previous artifacts');
});
test('private preview instance uses a dynamic loopback port and session-bound read/write API',()=>{
 const startup=read('windows-onefile-startup.cs.txt'),builder=read('build-onefile-windows.cjs'),runtime=read('build-runtime.cjs');
 for(const key of ['TcpListener(IPAddress.Loopback, 0)','FreeLoopbackPort','sessionToken','CRAFT_CENTER_PORT',
  'CHALLENGER_DESKTOP_SESSION','ValidateRuntime','PINNED_RUNTIME_MANIFEST_SHA256','SHA256.HashData'])
  assert.ok(startup.includes(key)||builder.includes(key),key);
 assert.ok(runtime.includes('desktopSessionVerified'));
 assert.ok(runtime.includes("req.headers['x-challenger-desktop-session']"));
 assert.ok(builder.includes('session.ValueKind==JsonValueKind.True'));
 assert.ok(builder.includes("target.Port != port"));
});
test('explicit native UAC escalation, no automatic elevated server or production launch script',()=>{
 const s=read('build-onefile-windows.cjs'),client=read('live-actions.js');
 assert.ok(s.includes('elevate-restart'));assert.ok(s.includes('Verb="runas"'));
 assert.ok(client.includes('window.confirm')&&client.includes('researchPendingVerification'));
 assert.ok(client.includes('X-Challenger-Desktop-Session'));
 assert.ok(client.includes('launch-result'),'Windows native launch result must reach UI');
 assert.ok(s.includes("if(cs.includes('Start-Center.ps1')"));
 assert.ok(s.includes('LogEngine("Native WebView2 initialized'));
 assert.ok(s.includes('Diagnostic log: '));
});
test('payload validation fails closed and does not touch production directory',()=>{
 const s=read('windows-onefile-startup.cs.txt');
 for(const x of ['manifestDigest','File.Exists','SHA256.HashData','StartsWith(rootPrefix','Payload path escaped',
  'incomplete'.toUpperCase().slice(0,0)||'Incomplete app payload','System.IO.Directory.Move(tmp, root)'])
  assert.ok(s.includes(x),x);
 assert.ok(s.includes('if (count < 67)'));
 assert.ok(!s.includes('CopyFolder('),'No duplicate unmanaged installs');
});
