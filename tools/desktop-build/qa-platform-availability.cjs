'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),
 net=require('node:net'),crypto=require('node:crypto'),cp=require('node:child_process');
const puppeteer=require('C:/Users/Chris/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const b=__dirname,runtime=path.join(b,'dist','runtime-preview12');
async function port(){
 const s=net.createServer();await new Promise((yes,no)=>s.once('error',no).listen(0,'127.0.0.1',yes));
 const n=s.address().port;await new Promise(yes=>s.close(yes));return n;
}
async function main(){
 const p=await port(),url='http://127.0.0.1:'+p,token=crypto.randomBytes(28).toString('hex');
 const service=cp.spawn(process.execPath,[path.join(runtime,'server.js')],{
  cwd:runtime,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,
   CRAFT_CENTER_PORT:String(p),CHALLENGER_DISABLE_SCAN:'1',CHALLENGER_DESKTOP_SESSION:token}
 });
 let browser;let output='';
 service.stdout.on('data',x=>output+=x.toString().slice(0,600));
 service.stderr.on('data',x=>output+=x.toString().slice(0,600));
 try{
  for(let i=0;i<50;i++){
   if(service.exitCode!==null)throw Error('Preview12 backend exited '+output);
   try{const x=await fetch(url+'/api/health',{signal:AbortSignal.timeout(600)});
    if(x.ok)break;}catch{}
   await new Promise(ok=>setTimeout(ok,240));
  }
  const state=await fetch(url+'/api/state').then(x=>x.json());
  assert.equal(state.platform,'win32');
  assert.ok(['x64','arm64'].includes(state.arch));
  assert.equal(state.apps.length,14);assert.equal(state.discoveries.length,152);
  const entries=[...state.apps,...state.discoveries];
  assert.ok(entries.every(x=>x.platformAvailability?.schema==='challenger-platform-availability.v1'));
  const compos=entries.find(x=>x.repo==='composa');
  const inf=entries.find(x=>x.repo==='infinite');
  assert.ok(compos);assert.ok(inf);
  assert.equal(compos.platformAvailability.entries.linux.state,'reported');
  assert.equal(compos.platformAvailability.entries.linux.installReady,false);
  assert.equal(inf.platformAvailability.entries.darwin.reviewedInstaller,true);
  assert.equal(inf.platformAvailability.entries.linux.reported,true);
  assert.ok(entries.every(x=>!x.platformAvailability.autoInstallAllowed));
  // Privileged route remains private even with a valid source-linked catalog item.
  const denied=await fetch(url+'/api/install',{method:'POST',headers:{'Content-Type':'application/json',
   'X-Requested-With':'CraftUpdateCenter'},body:JSON.stringify({repo:'composa'})});
  assert.equal(denied.status,403);
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(),errors=[],writes=[];
  page.on('pageerror',x=>errors.push(x.message));
  page.on('request',x=>{if(x.url().startsWith(url)&&!['GET','HEAD'].includes(x.method()))writes.push(x.url())});
  await page.setViewport({width:1100,height:760});
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#homeProjectCount')?.textContent.includes('181'),{timeout:16000});
  await page.evaluate(()=>goBrowse({domain:'all'}));
  await page.$eval('#exploreSearch',e=>{e.value='Composa'});
  await page.$eval('#exploreSearchForm',e=>e.requestSubmit());
  await page.waitForSelector('#exploreRows [data-project="composa"]');
  const row=await page.$eval('#exploreRows [data-project="composa"]',e=>{
   const tr=e.closest('tr');return {os:tr.querySelectorAll('.platform-badge').length,
    linux:tr.querySelector('.platform-badge[aria-label^="Linux"]')?.getAttribute('title')}});
  assert.equal(row.os,3);assert.match(row.linux,/reported/i);
  await page.click('#exploreRows [data-project="composa"]');
  const detail=await page.evaluate(()=>({
   count:document.querySelectorAll('#projectDocument .platform-availability-card .platform-badge').length,
   text:document.querySelector('#projectDocument .platform-local-message')?.textContent
  }));
  assert.equal(detail.count,3);assert.match(detail.text,/verified|installer|install/i);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  console.log('CHALLENGER_CROSSPLATFORM_AVAILABILITY_PASS '+JSON.stringify({
   managed:state.apps.length,independent:state.discoveries.length,candidateResearch:15,
   linuxReportedNotApproved:compos.platformAvailability.entries.linux.state,
   macAdapterReviewed:inf.platformAvailability.entries.darwin.reviewedInstaller,
   localPlatform:state.platform,localArch:state.arch,cardBadges:row.os,detailBadges:detail.count,
   unauthorizedInstallRejected:true,frontendWrites:0,scriptErrors:0}));
 }finally{
  if(browser)await browser.close();
  if(service.exitCode===null){service.kill('SIGTERM');await new Promise(ok=>{service.once('exit',ok);setTimeout(ok,1300)})}
 }
}
main().catch(e=>{console.error('CHALLENGER_CROSSPLATFORM_AVAILABILITY_FAIL '+(e.stack||e));process.exitCode=1});
