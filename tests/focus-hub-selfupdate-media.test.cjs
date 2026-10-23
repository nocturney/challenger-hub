'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {localVersion,vettedReleases,makeUpdateChecker}=require('../hub-updates');
const media=require('../repository-media');
const official='https://github.com/nocturney/challenger-hub/releases';
function release(n,change={}){
 const tag='v4.0.0-orbit-preview.'+n;
 return {tag_name:tag,draft:false,prerelease:true,published_at:'2026-10-23T15:00:00Z',assets:[{
  name:'ChallengerFocusDesktopPreview'+n+'.exe',size:89520559,
  digest:'sha256:'+'a'.repeat(64),
  browser_download_url:official+'/download/'+tag+'/ChallengerFocusDesktopPreview'+n+'.exe'}],...change};
}
test('self-update only trusts exact official preview release assets and checked digests',()=>{
 const input=[release(8,{draft:true}),release(9,{prerelease:false}),release(10,{assets:[{...release(10).assets[0],browser_download_url:'https://evil.test/out.exe'}]}),
  release(11,{assets:[{...release(11).assets[0],digest:null}]}),release(12),release(7)];
 const found=vettedReleases(input);
 assert.equal(found[0].preview,12);assert.equal(found[1].preview,7);
 assert.equal(found.length,2);
 assert.equal(found[0].downloadUrl,official+'/download/v4.0.0-orbit-preview.12/ChallengerFocusDesktopPreview12.exe');
});
test('installed Hub version comes from embedded runtime manifest, not old backend internal version',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hub-version-'));
 try{
  fs.writeFileSync(path.join(dir,'desktop-manifest.json'),JSON.stringify({version:'4.0.0-desktop.preview.7'}));
  assert.equal(localVersion(dir).preview,7);
  let queries=0,now=Date.parse('2026-10-23T14:00:00Z');
  const checker=makeUpdateChecker({root:dir,clock:()=>now,
   fetcher:async()=>{queries++;return [release(9),release(7)]}});
  const a=await checker.check();assert.equal(a.currentVersion,'4.0.0-desktop.preview.7');
  assert.equal(a.updateAvailable,true);assert.equal(a.upgrade.preview,9);
  assert.equal(a.installationAutomatic,false);
  assert.equal((await checker.check()).cached,true);assert.equal(queries,1);
  now+=120000;assert.equal((await checker.check({force:true})).cached,false);
  assert.equal(queries,2,'User-initiated update check must bypass 30-minute auto cache');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('official README candidates reject badges, marketing banners, cross-host and path traversal',()=>{
 const entries=media.candidates([
  '![Build](https://img.shields.io/badge/ci-pass.svg)',
  '![Actual screenshot](docs/screenshot.png)',
  '<img src="docs/app_editor.jpg" alt="Application interface">',
  '![Company logo](logo.png)'
 ].join('\n'));
 assert.ok(entries.some(x=>x.url==='docs/screenshot.png'));
 assert.ok(media.score(entries.find(x=>x.url==='docs/screenshot.png'))>media.score(entries.find(x=>x.url==='logo.png')));
 assert.equal(media.rawUrl('baserow/baserow','develop','docs/screenshot.png'),
  'https://raw.githubusercontent.com/baserow/baserow/develop/docs/screenshot.png');
 assert.equal(media.rawUrl('baserow/baserow','develop','https://example.net/screenshot.png'),null);
 assert.equal(media.rawUrl('baserow/baserow','develop','../../secret.png'),null);
 assert.equal(media.rawUrl('baserow/baserow','develop','https://raw.githubusercontent.com/evil/repo/main/shot.png'),null);
});
test('owner avatar is sourced from verified GitHub identity but never treated as app logo',()=>{
 const app={repo:'baserow',repository:'baserow/baserow',discovery:true,ownerAvatarUrl:'https://avatars.githubusercontent.com/u/68540644?v=4'};
 assert.equal(media.avatarSource(app),app.ownerAvatarUrl);
 assert.equal(media.avatarSource({...app,ownerAvatarUrl:'https://evil.example/brand.png'}),null);
 assert.equal(media.avatarSource({...app,repository:'http://localhost/insecure'}),null);
 const ui=fs.readFileSync(path.join(__dirname,'../tools/desktop-build/live-project-media.js'),'utf8');
 assert.ok(ui.includes('not an official product logo'));
 assert.ok(ui.includes('SCREENSHOT IN OFFICIAL PROJECT README'));
});
test('native shell and compact UI preserve version/check control and maximize the app',()=>{
 const builder=fs.readFileSync(path.join(__dirname,'../tools/desktop-build/build-onefile-windows-preview7.cjs'),'utf8');
 const runtime=fs.readFileSync(path.join(__dirname,'../tools/desktop-build/build-runtime.cjs'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../tools/desktop-build/viewport-fit.css'),'utf8');
 assert.ok(builder.includes('WindowState = FormWindowState.Maximized'));
 for(const key of ['hubCheckUpdates','hubVersion','hubUpdateState','live-project-media.js','hub-update-ui.js',"['7','8','9'].includes(preview)"])
  assert.ok(runtime.includes(key),key);
 assert.ok(css.includes('max-height:745px')&&css.includes('home-opening h1'));
});
