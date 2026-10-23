'use strict';
/* Safe Preview10 modern surface visual acceptance; source app remains unmodified. */
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),
 cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const puppeteer=require('C:/Users/Chris/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const baseDir=__dirname,runtime=path.join(baseDir,'dist','runtime-preview10');
const shots=path.join(baseDir,'dist','qa-modern-surface-preview10');
async function port(){
 const s=net.createServer();
 await new Promise((resolve,reject)=>s.once('error',reject).listen(0,'127.0.0.1',resolve));
 const num=s.address().port;
 await new Promise(resolve=>s.close(resolve));
 return num;
}
async function main(){
 if(!fs.existsSync(path.join(runtime,'server.js')))throw Error('Build runtime preview10 first');
 fs.mkdirSync(shots,{recursive:true});
 const portNum=await port(),base='http://127.0.0.1:'+portNum;
 const worker=cp.spawn(process.execPath,[path.join(runtime,'server.js')],{
  cwd:runtime,stdio:['ignore','pipe','pipe'],windowsHide:true,env:{
   ...process.env,CRAFT_CENTER_PORT:String(portNum),CHALLENGER_DISABLE_SCAN:'1',
   CHALLENGER_DESKTOP_SESSION:crypto.randomBytes(24).toString('hex')
  }
 });
 let backendLog='';
 worker.stdout.on('data',x=>{backendLog+=x.toString().slice(0,2000)});
 worker.stderr.on('data',x=>{backendLog+=x.toString().slice(0,2000)});
 let browser;
 try{
  let ready=false;
  for(let i=0;i<32;i++){
   if(worker.exitCode!==null)throw Error('Preview engine exited: '+backendLog);
   try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(700)});
    if(r.ok){ready=true;break}}catch{}
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!ready)throw Error('Preview engine not ready: '+backendLog);
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(),errors=[],writes=[],external=[];
  page.on('pageerror',e=>errors.push(String(e.message)));
  page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
  page.on('request',r=>{
   if(r.url().startsWith(base)){if(!['GET','HEAD'].includes(r.method()))writes.push(r.method()+' '+r.url())}
   else if(!r.url().startsWith('about:'))external.push(r.url());
  });
  await page.setViewport({width:1100,height:760});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#homeProjectCount')?.textContent.includes('181')&&
   document.querySelectorAll('#disciplineList .discipline-row').length===17,{timeout:20000});
  const home=await page.evaluate(()=>({
   title:document.querySelector('.home-opening h1').textContent.replace(/\s+/g,' ').trim(),
   search:document.getElementById('homeSearch').getBoundingClientRect().bottom,
   cards:getComputedStyle(document.querySelector('.discipline-row')).borderRadius,
   footer:document.querySelector('.global-footer').getBoundingClientRect().bottom,
   viewport:innerHeight,overflow:document.documentElement.scrollWidth-innerWidth
  }));
  assert.match(home.title,/Explore better tools/);
  assert.ok(home.search<home.viewport*.73,'Home search fell below first viewport '+JSON.stringify(home));
  assert.ok(home.overflow<=1);
  assert.ok(parseInt(home.cards)>=8,'Categories must be app tiles');
  assert.ok(home.footer<=home.viewport+2);
  await page.screenshot({path:path.join(shots,'home-1100-light.png')});
  await page.evaluate(()=>goBrowse({domain:'all'}));
  await page.waitForFunction(()=>document.querySelector('#resultCount')?.textContent==='181');
  let grid=await page.evaluate(()=>({
   columns:getComputedStyle(document.querySelector('#exploreRows')).gridTemplateColumns,
   display:getComputedStyle(document.querySelector('#exploreRows')).display,
   first:document.querySelector('#exploreRows tr')?.getBoundingClientRect().width,
   total:document.querySelectorAll('#exploreRows tr').length,
   overflow:document.documentElement.scrollWidth-innerWidth
  }));
  assert.equal(grid.display,'grid');
  assert.equal(grid.columns.split(' ').length,2,'Desktop must display a two-column card grid');
  assert.equal(grid.total,30);
  assert.ok(grid.overflow<=1);
  await page.screenshot({path:path.join(shots,'results-1100-light.png')});
  await page.$eval('#exploreSearch',e=>{e.value='Dune 3D'});
  await page.$eval('#exploreSearchForm',e=>e.requestSubmit());
  await page.waitForSelector('#exploreRows [data-project="dune3d"]');
  await page.click('#exploreRows [data-project="dune3d"]');
  await page.waitForSelector('#projectScreen:not([hidden])');
  const dossier=await page.evaluate(()=>({
   title:document.querySelector('#projectDocument .project-name')?.textContent,
   tabs:document.querySelectorAll('.primary-nav .main-tab').length,
   card:parseInt(getComputedStyle(document.querySelector('.project-identity')).borderRadius),
   source:document.querySelector('.project-identity-status a')?.href,
   overflow:document.documentElement.scrollWidth-innerWidth
  }));
  assert.equal(dossier.title,'Dune 3D');assert.equal(dossier.tabs,3);
  assert.ok(dossier.card>=12);
  assert.ok(dossier.source?.startsWith('https://github.com/'));
  assert.ok(dossier.overflow<=1);
  await page.waitForFunction(()=>[...document.querySelectorAll('#projectDocument img.project-screenshot')].some(img=>img.complete&&img.naturalWidth>0),{timeout:15000});
  await page.screenshot({path:path.join(shots,'dossier-1100-light.png')});
  await page.click('#themeSwitch');
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
  await page.screenshot({path:path.join(shots,'dossier-1100-dark.png')});
  const sizes=[];
  for(const [width,height] of [[780,540],[430,820],[320,700]]){
   await page.setViewport({width,height});
   await page.evaluate(()=>goHome());
   await page.waitForSelector('#homeScreen:not([hidden])');
   const dims=await page.evaluate(()=>({
    width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth-innerWidth,
    footer:document.querySelector('.global-footer').getBoundingClientRect().bottom,
    search:document.querySelector('#homeSearch').getBoundingClientRect().bottom,
    cols:getComputedStyle(document.querySelector('#disciplineList')).gridTemplateColumns
   }));
   assert.ok(dims.overflow<=1,'Responsive horizontal overflow '+JSON.stringify(dims));
   assert.ok(dims.footer<=height+2,'Footer must stay in viewport '+JSON.stringify(dims));
   if(width>=780)assert.ok(dims.search<height*.75,'Search below viewport '+JSON.stringify(dims));
   await page.screenshot({path:path.join(shots,'home-'+width+'-dark.png')});
   sizes.push(dims);
   await page.evaluate(()=>goBrowse({domain:'all'}));
   const result=await page.evaluate(()=>({
    cols:getComputedStyle(document.getElementById('exploreRows')).gridTemplateColumns,
    overflow:document.documentElement.scrollWidth-innerWidth
   }));
   assert.ok(result.overflow<=1,'Responsive card overflow '+JSON.stringify(result));
   if(width===430)assert.equal(result.cols.split(' ').length,1);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(external,[]);
  // Retain Preview 10 catalog/search and official media integration acceptance.
  for(const script of ['qa-open-discovery10.cjs','qa-craft-media10.cjs']){
   const check=cp.spawnSync(process.execPath,[path.join(baseDir,script)],{
    encoding:'utf8',timeout:110000,windowsHide:true,
    env:{...process.env,CHALLENGER_V10_QA_PORT:String(portNum)}
   });
   if(check.stdout)process.stdout.write(check.stdout);
   if(check.stderr)process.stderr.write(check.stderr);
   assert.equal(check.status,0,'Existing Preview10 browser QA failed: '+script);
  }
  console.log('MODERN_SURFACE_PREVIEW10_PASS '+JSON.stringify({
   home,grid,dossier,sizes,jsErrors:errors.length,writes:writes.length,
   externalBrowserRequests:external.length,screenshots:fs.readdirSync(shots).length
  }));
 }finally{
  if(browser)await browser.close();
  if(worker.exitCode===null){worker.kill('SIGTERM');await new Promise(resolve=>{
   worker.once('exit',resolve);setTimeout(resolve,1300);
  })}
 }
}
main().catch(e=>{console.error('MODERN_SURFACE_PREVIEW10_FAIL '+(e.stack||e));process.exitCode=1});
