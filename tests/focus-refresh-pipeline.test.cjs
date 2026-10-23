'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {makeScanner}=require('../source-scanner');
const {normalizeProjects}=require('../registry-live');
const root=path.resolve(__dirname,'..');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'challenger-refresh-test-'));
const headers={get(){return null}};
function atom(repo,tag){return '<feed><entry><link href="https://github.com/'+repo+'/releases/tag/'+tag+'"/></entry></feed>'}
function mock(status,body){return {ok:status>=200&&status<300,status,headers,async text(){return body}}}
test('manual refresh genuinely checks project sources with bounded parallelism and visible progress',async()=>{
 const dir=tmp();let running=0,maxRunning=0,requests=0;
 try{
  const rows=Array.from({length:6},(_,i)=>({id:'project-'+i,kind:'independent',repository:'maker/project-'+i}));
  const scanner=makeScanner({root:dir,list:()=>rows,disableTimers:true,
   config:()=>({autoCheck:true,intervalHours:12}),discovery:async()=>true,
   fetcher:async url=>{
    running++;maxRunning=Math.max(maxRunning,running);requests++;
    await new Promise(r=>setTimeout(r,30));running--;
    return mock(200,atom(url.split('github.com/')[1].split('/releases.atom')[0],'v2.6.1'));
   }
  });
  const requested=scanner.requestAll();assert.equal(requested.queued,7);
  assert.equal(scanner.requestAll().cooldown,true);
  const outcome=await scanner.drainRequested();
  assert.equal(outcome.queued,0);assert.equal(scanner.status().scanProgress.completed,7);
  assert.equal(scanner.status().fresh,6);assert.equal(scanner.status().checked,6);
  assert.equal(scanner.status().scanProgress.failed,0);
  assert.ok(maxRunning<=3);assert.ok(requests>=6);assert.ok(scanner.readSnapshot().roundCompleted>=1);
  for(const row of rows)assert.equal(scanner.publicSignal(row.id).signalTag,'v2.6.1');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('orphan historical ETag is refetched without If-None-Match',async()=>{
 const dir=tmp(),url='https://github.com/FlowiseAI/Flowise/releases.atom';let conditional=null;
 try{
  fs.writeFileSync(path.join(dir,'source-signals.json'),JSON.stringify({
   schema:'challenger-source-signals.v1',items:{flowise:{etagByHost:{[url]:{etag:'W/"orphan"'}}}},
   hostBackoff:{},cursor:0,roundCompleted:0
  }));
  const scan=makeScanner({root:dir,disableTimers:true,
   list:()=>[{id:'flowise',kind:'independent',repository:'FlowiseAI/Flowise'}],
   fetcher:async(_url,opts)=>{conditional=opts.headers['If-None-Match'];return mock(200,atom('FlowiseAI/Flowise','v3.1.0'))},
   config:()=>({autoCheck:true,intervalHours:12}),discovery:async()=>true});
  scan.requestAll();await scan.tick({force:true});
  assert.equal(conditional,undefined);
  assert.equal(scan.publicSignal('flowise').signalTag,'v3.1.0');
  assert.equal(scan.publicSignal('flowise').error,null);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('scan button refreshes managed catalog AND independent repository facts as well as source signals',()=>{
 const srv=fs.readFileSync(path.join(root,'server.js'),'utf8'),
       ui=fs.readFileSync(path.join(root,'tools','desktop-build','live-actions.js'),'utf8');
 for(const x of ['scanCatalog(true)','registryLive.refresh({root:ROOT','scanner.drainRequested()',
  'catalogStatus:','registryStatus:','refreshedReleases','releaseFailures'])assert.ok(srv.includes(x),x);
 for(const x of ['catalog.checkedAt','registry.lastCompletedAt','src.scanProgress',
  'catalog.scanning','registry.scanning'])assert.ok(ui.includes(x),x);
 assert.ok(srv.includes("No published release yet"));
 assert.ok(srv.includes("runChild('gh'"),'Existing read-only authenticated GitHub access not used');
});
test('upstream repository metadata refresh is typed and never grants installation rights',()=>{
 const live=fs.readFileSync(path.join(root,'registry-live.js'),'utf8'),
       srv=fs.readFileSync(path.join(root,'server.js'),'utf8');
 assert.equal(normalizeProjects([{id:'abc',repository:'Foo/Bar'},
  {id:'abc',repository:'evil/override'},{id:'x',repository:'https://evil.com'}]).length,1);
 assert.ok(live.includes("isArchived"));assert.ok(live.includes('observedTag'));
 assert.ok(!live.includes('installable:true')&&!live.includes('enqueue('));
 assert.ok(srv.includes("releaseStrategy:'unverified',installAdapter:null,installable:false"));
});

test('mixed-case newly discovered repositories are included in release scanning',()=>{
 const {allTasks}=require('../source-scanner');
 const tasks=allTasks([
  {id:'AniCraft',repository:'storytold/AniCraft',kind:'craft'},
  {id:'another-project',repository:'maker/another-project',kind:'independent'}
 ]);
 assert.ok(tasks.some(x=>x.id==='anicraft'&&x.repository==='storytold/AniCraft'));
 assert.equal(tasks.length,3,'Both sources plus one owner-directory job');
});

test('prepacked catalog has no actual customer machine install versions or paths',()=>{
 const f=path.join(root,'tools','desktop-build','seeds','managed-catalog.preview6.json');
 const snapshot=JSON.parse(fs.readFileSync(f,'utf8'));
 assert.equal(snapshot.apps.length,14);
 for(const app of snapshot.apps){
  assert.equal(app.installedPath,null);
  assert.equal(app.installedVersion,null);
  assert.equal(!!app.needsUpdate,false);
 }
});
