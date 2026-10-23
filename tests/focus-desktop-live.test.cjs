'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),desk=path.join(root,'tools','desktop-build');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('Live Focus reuses vetted real backend instead of a shadow/install simulation',()=>{
 const src=fs.readFileSync(path.join(desk,'build-runtime.cjs'),'utf8');
 for(const key of ['server.js','challenger-core.js','source-scanner.js','Install-Challenger.js','adapters.json','portable-assets.json'])
  assert.ok(src.includes("'"+key+"'"),'Missing reused real service file: '+key);
 assert.match(src,/liveApi:true/);
 assert.match(src,/\'api\/install\'|trustedActions:\['scan','verify','install'/);
 assert.match(src,/SHA256-MANIFEST.json/);
 assert.match(src,/Refusing to overwrite desktop runtime/);
});
test('System-changing actions require explicit confirmation, and research-only software stays blocked',()=>{
 const src=fs.readFileSync(path.join(desk,'live-actions.js'),'utf8');
 for(const key of ['researchPendingVerification','!a.installable','window.confirm','/api/','X-Requested-With',
  'update-all','download-portable','scan','verify','launch','elevate-restart'])
  assert.ok(src.includes(key),key);
 assert.ok(!src.includes('Demo installed'));
 assert.doesNotMatch(src,/eval\(|new Function\(|shell:\s*true/);
 const open=src.match(/fetch\('\/api\/'\+map\[op\]/g)||[];
 assert.equal(open.length,1);
});
test('Desktop Windows native shell uses WebView2 with strictly local bounded service',()=>{
 const src=fs.readFileSync(path.join(desk,'build-windows.cjs'),'utf8');
 const setup=fs.readFileSync(path.join(desk,'windows-startup-snippet.cs.txt'),'utf8');
 assert.ok(src.includes("WebView")||src.includes('WebView2')||src.includes('CraftUpdateCenter.csproj'));
 for(const x of ['17964','IsAdministrator','elevate-restart','Kill(true)','Refusing to overwrite','self-contained'])
  assert.ok(src.includes(x),'missing Windows gate '+x);
 assert.ok(src.includes('LocalApplicationData'));
 assert.ok(setup.includes('CRAFT_CENTER_PORT'));
 assert.ok(setup.includes('source-signals.json'));
 assert.ok(!setup.includes('Install-CraftSuite.ps1'));
});
test('Desktop macOS native WKWebView wraps bundled Node and stops its own service',()=>{
 const src=fs.readFileSync(path.join(desk,'build-mac.cjs'),'utf8');
 for(const key of ['WKFrameInfo','runJavaScriptConfirmPanelWithMessage','ownedService','p.terminate()',
  'Challenger Focus Desktop','macOS','.dmg','bundleRuntime','bundledNode','codesign']){
  assert.ok(src.includes(key),key);
 }
 assert.ok(!src.includes('com.apple.security.app-sandbox'));
});
test('Approved bundled media retains original source hashes and source identity',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools','preview-build','media-source','project-media.v1.json')));
 const entries=Object.entries(manifest.projects).filter(([id,p])=>p.screenshot);
 assert.equal(entries.length,3);
 for(const [id,p] of entries){
  const s=p.screenshot;assert.equal(s.status,'approved');assert.equal(s.type,'application-ui-screenshot');
  const b=fs.readFileSync(path.join(root,'tools','preview-build','media-source','assets','screenshots',id+'.png'));
  assert.equal(sha(b),s.sha256);
  assert.match(s.sourceCommit,/^[a-f0-9]{40}$/);
 }
});
