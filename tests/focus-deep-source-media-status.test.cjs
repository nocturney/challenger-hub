'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const source=require('../independent-source-media');
const managed=require('../managed-install-status');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'independent-media.v1.json'),'utf8'));
const registry=require('../challengers.json').projects;
const safe=(id)=>{const row=registry.find(x=>x.id===id);return {repo:id,repository:row.repository,discovery:true}};
test('all curated assets were independently SHA256 verified from exact pinned original Git trees',()=>{
 assert.equal(manifest.schema,'challenger-independent-media.v1');
 assert.equal(manifest.stats.projects,36);
 assert.equal(manifest.stats.screenshots,46);
 assert.equal(manifest.stats.icons,16);
 assert.equal(manifest.stats.failed,1);
 const rows=Object.entries(manifest.apps);
 assert.equal(rows.length,36);
 for(const [id,entry] of rows){
  const app=safe(id);assert.equal(app.repository,entry.repository);
  assert.match(entry.commit,/^[a-f0-9]{40}$/);
  for(const [kind,records] of [['screenshot',entry.screenshots],['icon',entry.icon?[entry.icon]:[]]]){
   records.forEach((image,index)=>{
    assert.deepEqual(source.item(app,kind,index)?.entry,image);
    assert.match(image.sha256,/^[a-f0-9]{64}$/);
    assert.match(image.gitBlobSha,/^[a-f0-9]{40}$/);
    assert.ok(image.bytes>500&&image.bytes<2400000);
    assert.equal(image.source,'https://github.com/'+entry.repository+'/blob/'+entry.commit+
     '/'+image.path.split('/').map(encodeURIComponent).join('/'));
   });
  }
 }
});
test('source media may never be redirected to another author or an arbitrary URL',()=>{
 assert.equal(source.listed({...safe('baserow'),repository:'evil/elsewhere'}),null);
 assert.equal(source.item(safe('baserow'),'screenshot',500),null);
 assert.equal(source.item(safe('baserow'),'icon',-1),null);
 assert.equal(source.item(safe('grida'),'icon'),null); // The automated scan found Adidas etc, NOT Grida logos
 const data=source.clientIndex();assert.equal(Object.keys(data.apps).length,36);
 assert.ok(data.apps.baserow.screenshots[0].source.includes('/baserow/baserow/blob/'));
});
test('a checksum mismatch rejects network image bytes without exposing them to UI',async()=>{
 const app=safe('baserow');
 let called=0;
 const fake=async(url)=>{
  called++;assert.ok(url.startsWith('https://raw.githubusercontent.com/baserow/baserow/'));
  return {ok:true,url,headers:new Headers({'content-length':'600'}),
   arrayBuffer:async()=>new Uint8Array(600).buffer};
 };
 assert.equal(await source.get(app,'screenshot',0,fake),null);
 assert.equal(called,1);
});
test('managed installer state preserves old observation on network failures, never fabricates up-to-date',()=>{
 const current=managed.assess({installedVersion:'0.4.0',installedPath:'C:\\Software\\CADCraft.exe',releaseTag:'v0.5.0',needsUpdate:true});
 assert.equal(current.state,'UpdateAvailable');assert.equal(current.ownerVerified,false);
 assert.equal(current.mayAutoReplace,false);
 assert.equal(managed.assess({installedVersion:'0.4.0',releaseTag:'v0.5.0',error:'Cached release metadata'}).state,'InstalledCheckUnavailable');
 assert.equal(managed.assess({installedVersion:'0.4.0',releaseTag:'v0.5.0',current:true}).state,'UpToDate');
 assert.equal(managed.assess({assetIssue:'No published release yet'}).state,'NoRelease');
 assert.equal(managed.assess({releaseTag:'v0.5.0',installable:false}).state,'NoCompatibleAsset');
 assert.equal(managed.assess({releaseTag:'v0.5.0',installable:true}).state,'Available');
 assert.equal(managed.assess({error:'HTTP 403'}).state,'SourceUnavailable');
});
test('source screenshots are loaded through bounded loopback routes; no external browser request',()=>{
 const srv=fs.readFileSync(path.join(root,'server.js'),'utf8');
 const ui=fs.readFileSync(path.join(root,'tools/desktop-build/live-project-media.js'),'utf8');
 const build=fs.readFileSync(path.join(root,'tools/desktop-build/build-runtime.cjs'),'utf8');
 for(const s of ['/api/repository-media/official-icon','/api/repository-media/official-screenshot']){
  assert.ok(srv.includes(s),s);assert.ok(ui.includes(s),s);
 }
 assert.ok(build.includes('SOURCE_PINNED_INDEPENDENT_MEDIA_BUNDLED'));
 assert.ok(build.includes('independent-media-index.js'));
 assert.ok(ui.includes('View exact upstream file'));
 assert.ok(ui.includes('verified-source-offline'));
 assert.ok(srv.includes('managedInstallStatus.assess(meta)'));
});
