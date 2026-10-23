'use strict';
/* Repeatable safe acceptance for the embedded engine and UI. Never queues installers. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),
 net=require('node:net'),cp=require('node:child_process'),assert=require('node:assert/strict');
if(process.platform!=='win32')throw Error('Windows QA must run on authorized Windows host');
const build=path.join(__dirname,'dist','onefile-preview8'),payload=path.join(build,'payload-stage');
const exe=path.join(build,'publish','ChallengerFocusDesktopPreview8.exe');
const source=path.join(build,'source','Program.cs'),qa=path.join(__dirname,'dist','onefile-preview8-safe-qa');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const assertBinary=()=>{
 const evidence=JSON.parse(fs.readFileSync(path.join(build,'build-evidence.json')));
 assert.equal(hash(exe),evidence.sha256);
 assert.ok(fs.statSync(exe).size>50_000_000);
 const hashes=JSON.parse(fs.readFileSync(path.join(payload,'SHA256-MANIFEST.json')));
 assert.ok(hashes['node.exe'],'Node executable is not integrity pinned');
 assert.ok(hashes['NODE-LICENSE.txt'],'Node license is not included');
 for(const [name,want] of Object.entries(hashes)){
  assert.equal(hash(path.join(payload,name)),want,'Payload bytes changed: '+name);
 }
 const program=fs.readFileSync(source,'utf8');
 const manifestHash=hash(path.join(payload,'SHA256-MANIFEST.json')).toUpperCase();
 assert.ok(program.includes(manifestHash),'Native EXE source must pin immutable manifest');
 assert.ok(program.includes('FreeLoopbackPort'),'Missing dynamic private port');
 assert.ok(program.includes('desktopSessionVerified'),'Missing private engine identity check');
 assert.ok(program.includes('NavigationCompleted'),'Missing UI startup diagnostics');
 assert.ok(!program.includes('Start-Center.ps1'),'Production launcher must not be required');
 return {exeSha256:evidence.sha256,embeddedFiles:Object.keys(hashes).length,bytes:fs.statSync(exe).size};
};
async function freePort(){
 const server=net.createServer();
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 await new Promise(resolve=>server.close(resolve));return port;
}
async function main(){
 const proof=assertBinary();
 if(fs.existsSync(qa))throw Error('QA sandbox already exists; refusing overwrite');
 fs.cpSync(payload,qa,{recursive:true});
 const stateRoot='D:/Velvet/Installers/CraftSuite/Center';
 for(const filename of ['catalog-cache.json','source-signals.json']){
  if(!fs.existsSync(path.join(qa,filename))&&fs.existsSync(path.join(stateRoot,filename)))
   fs.copyFileSync(path.join(stateRoot,filename),path.join(qa,filename));
 }
 const seeded=JSON.parse(fs.readFileSync(path.join(qa,'catalog-cache.json'),'utf8'));
 const curated=JSON.parse(fs.readFileSync(path.join(qa,'registry-live-metadata.json'),'utf8'));
 assert.equal(seeded.apps.length,14,'Latest managed catalog must be bundled');
 assert.equal(seeded.apps.find(a=>a.repo==='cadcraft')?.releaseTag,'v0.12.0');
 assert.equal(curated.stats.checked,152,'All curated independent projects need current metadata');
 assert.equal(curated.items.compositor?.observedTag,'v1.5.6');
 const port=await freePort(),session=crypto.randomBytes(24).toString('hex');
 const worker=cp.spawn(path.join(qa,'node.exe'),[path.join(qa,'server.js')],{
  cwd:qa,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{
   ...process.env,CRAFT_CENTER_PORT:String(port),CHALLENGER_DESKTOP_SESSION:session,CHALLENGER_DISABLE_SCAN:'1'
  }});
 let output='';
 worker.stdout.on('data',x=>output+=x.toString());
 worker.stderr.on('data',x=>output+=x.toString());
 try{
  let alive=false;
  for(let i=0;i<36;i++){
   if(worker.exitCode!==null)throw Error('QA backend died: '+output);
   try{
    const health=await fetch('http://127.0.0.1:'+port+'/api/health',{signal:AbortSignal.timeout(900)});
    if(health.ok){alive=true;break}
   }catch{}
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!alive)throw Error('QA backend not ready: '+output);
  const live=await fetch('http://127.0.0.1:'+port+'/api/state').then(r=>r.json());
  assert.equal(live.catalogStatus.count,14);
  assert.equal(live.registryStatus.cachedItems,152);
  const cad=live.apps.find(a=>a.repo==='cadcraft');
  assert.equal(cad?.latestVersion,'0.12.0');
  const compositor=live.discoveries.find(a=>a.repo==='compositor');
  assert.equal(compositor?.observedReleaseTag,'v1.5.6');
  assert.ok(compositor?.stars>17000,'Current creator metadata did not ship');
  assert.ok(live.discoveries.filter(x=>x.ownerAvatarUrl).length>=120,'Creator avatars absent');
  assert.ok(compositor?.repositoryMetadataCheckedAt?.startsWith('2026-10-23'));
  assert.equal(compositor?.installable,false);
  console.log('FRESH_CATALOG_AND_RESEARCH_METADATA_VERIFIED '+JSON.stringify({
   managed:live.apps.length,independent:live.discoveries.length,
   cadcraftLatest:cad.latestVersion,compositorTag:compositor.observedReleaseTag}));
  const start=Date.now();
  const qaRunner=cp.spawnSync(process.execPath,[path.join(__dirname,'qa-live.cjs')],{
   encoding:'utf8',windowsHide:true,timeout:110000,
   env:{...process.env,FOCUS_DESKTOP_TEST_PORT:String(port),FOCUS_DESKTOP_QA_VERSION:'4.0.0-desktop.preview.8',
    FOCUS_DESKTOP_QA_SESSION:session,FOCUS_TEST_SCAN_BUTTON:'1'}
  });
  if(qaRunner.stdout)process.stdout.write(qaRunner.stdout);
  if(qaRunner.stderr)process.stderr.write(qaRunner.stderr);
  if(qaRunner.status!==0)throw Error('Browser and authenticated API QA failed (code '+qaRunner.status+')');
  const report=JSON.parse(fs.readFileSync(path.join(__dirname,'dist','qa-win32-onefile-preview8','live-qa.json')));
  assert.equal(report.cases,10);
  assert.equal(report.verifyAction,true);
  assert.equal(report.scanButtonTriggered,true,'UI scan button did not start live sources+catalog+metadata refresh');
  assert.equal(report.errors.length,0);
  assert.equal(report.external.length,0);
  const visual=cp.spawnSync(process.execPath,[path.join(__dirname,'qa-visual8.cjs')],{
   encoding:'utf8',windowsHide:true,timeout:115000,
   env:{...process.env,CHALLENGER_V8_QA_PORT:String(port)}
  });
  if(visual.stdout)process.stdout.write(visual.stdout);
  if(visual.stderr)process.stderr.write(visual.stderr);
  if(visual.status!==0)throw Error('Native packaged v8 viewport/version/source-media QA failed');
  const shell=cp.spawnSync(process.execPath,[path.join(__dirname,'qa-shell-quality8.cjs')],{
   encoding:'utf8',windowsHide:true,timeout:115000,
   env:{...process.env,CHALLENGER_V8_QA_PORT:String(port)}
  });
  if(shell.stdout)process.stdout.write(shell.stdout);
  if(shell.stderr)process.stderr.write(shell.stderr);
  if(shell.status!==0)throw Error('SlicerBridge-style shell & evidence quality QA failed');
  const craft=cp.spawnSync(process.execPath,[path.join(__dirname,'qa-craft-media8.cjs')],{
   encoding:'utf8',windowsHide:true,timeout:120000,
   env:{...process.env,CHALLENGER_V8_QA_PORT:String(port)}
  });
  if(craft.stdout)process.stdout.write(craft.stdout);
  if(craft.stderr)process.stderr.write(craft.stderr);
  if(craft.status!==0)throw Error('Official source-pinned 13-icon 47-shot Craft App gallery failed');
  console.log('ONEFILE_WINDOWS_QA_PASS '+JSON.stringify({...proof,qaCases:report.cases,
   authHeader:'random secret, no unauthorized mutations',qaMs:Date.now()-start}));
 }finally{
  if(worker.exitCode===null){
   worker.kill('SIGTERM');
   await new Promise(resolve=>{worker.once('exit',resolve);setTimeout(resolve,1500)});
  }
  fs.rmSync(qa,{recursive:true,force:true});
 }
}
main().catch(e=>{console.error('ONEFILE_WINDOWS_QA_FAIL',e.stack||String(e));process.exitCode=1});
