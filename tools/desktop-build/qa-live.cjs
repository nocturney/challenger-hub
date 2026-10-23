'use strict';
/* Real cross-platform Chromium/WebKit-compatible page checks against ACTIVE local Challenger engine.
 * Safe: verify only. Never request an approved install/update/download/launch. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const port=17964,base='http://127.0.0.1:'+port+'/',platform=process.platform;
const dir=path.join(__dirname,'dist','qa-'+platform);
const puppeteer=require(platform==='darwin'?
 '/Users/chris/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer':
 'C:/Users/Chris/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
(async()=>{
 const health=await fetch(base+'api/health').then(r=>r.json());
 assert.equal(health.app,'Challenger Focus Desktop');
 assert.equal(health.mode,'LIVE_LOCAL_PREVIEW');
 assert.equal(health.version,'4.0.0-desktop.preview.4');
 const state=await fetch(base+'api/state').then(r=>r.json());
 assert.ok(state.apps.length>=12&&state.apps.length<=20,'Unexpected locally cached managed app count');
 assert.equal(state.discoveries.length,152);
 assert.equal(state.discoveries.filter(a=>a.researchPendingVerification).length,73);
 assert.ok(typeof state.computer==='string'&&state.computer.length);
 const denied=await fetch(base+'api/install',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 assert.equal(denied.status,403);
 const unknown=await fetch(base+'api/install',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'CraftUpdateCenter'},body:'{"repo":"unapproved-project"}'});
 assert.equal(unknown.status,400);
 const forbidden=await fetch(base+'server.js');assert.equal(forbidden.status,404);
 fs.mkdirSync(dir,{recursive:true});
 const browser=await puppeteer.launch({headless:true,
  executablePath:platform==='darwin'?'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge':undefined,
  args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage(),errors=[],external=[],writes=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
 page.on('request',r=>{
  if(r.url().startsWith(base)){if(!['GET','HEAD'].includes(r.method()))writes.push(r.method()+' '+r.url())}
  else if(!r.url().startsWith('about:'))external.push(r.url());
 });
 try{
  for(const width of [1590,1040,768,430,320]){
   await page.setViewport({width,height:940,deviceScaleFactor:1});
   for(const theme of ['light','dark']){
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelectorAll('.discipline-row').length===17,{timeout:12000});
    await page.waitForFunction(()=>document.getElementById('connectionState')?.classList.contains('connected'),{timeout:20000});
    if(theme==='dark')await page.click('#themeSwitch');
    const homepage=await page.evaluate(()=>({
     overflow:document.documentElement.scrollWidth>innerWidth+1,
     categories:document.querySelectorAll('.discipline-row .discipline-icon').length,
     toolbar:!!document.querySelector('#liveToolbar button[data-operation="scan"]'),
     warnings:document.querySelector('.source-notice')?.textContent||''
    }));
    assert.ok(!homepage.overflow);assert.equal(homepage.categories,17);assert.ok(homepage.toolbar);
    if(width===1590&&theme==='light')await page.screenshot({path:path.join(dir,'focus-desktop-live-home.png')});
    for(const p of [{repo:'dune3d',name:'Dune 3D'},
      {repo:'material-maker',name:'Material Maker'},
      {repo:'real-video-enhancer',name:'REAL Video Enhancer'}]){
      await page.$eval('#homeSearch',(el,name)=>{el.value=name},p.name);
      await page.$eval('#homeSearchForm',form=>form.requestSubmit());
      await page.waitForSelector('#exploreRows [data-project="'+p.repo+'"]',{timeout:15000});
      await page.click('#exploreRows [data-project="'+p.repo+'"]');
      await page.waitForFunction((name)=>{
        const img=document.querySelector('.project-screenshot'),icon=document.querySelector('.project-identity .official-project-icon');
        return document.querySelector('.project-name')?.textContent===name&&img?.complete&&img?.naturalWidth>600&&icon?.naturalWidth>0;
      },{timeout:13000},p.name);
      const v=await page.evaluate(()=>({
        src:document.querySelector('.project-screenshot')?.getAttribute('src'),
        overflow:document.documentElement.scrollWidth>innerWidth+1,
        live:document.querySelector('.prototype-note')?.textContent||'',
        buttons:[...document.querySelectorAll('.focus-action')].map(b=>b.dataset.operation),
        caption:document.querySelector('.project-media-figure figcaption')?.textContent||''
      }));
      assert.equal(v.src,'/media/screenshots/'+p.repo+'.png');assert.ok(!v.overflow);
      assert.ok(v.caption.includes('ACTUAL APPLICATION SCREENSHOT'));
      if(width===1590||width===430)await page.screenshot({path:path.join(dir,p.repo+'-'+theme+'-'+width+'.png')});
      await page.click('#brandHome');
    }
    const research=state.discoveries.find(x=>x.researchPendingVerification);
    assert.ok(research);
    checks.push({width,theme,status:'PASS'});
   }
  }
  // Safe "verify installed" action: no installation or software update.
  await page.setViewport({width:1590,height:900});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('connectionState')?.classList.contains('connected'));
  await page.click('[data-operation="verify"]');
  await page.waitForFunction(()=>document.getElementById('operationNotice')?.textContent.includes('refreshed'),{timeout:15000});
  assert.deepEqual(external,[],'web UI sent unexpected external browser requests');
  assert.deepEqual(errors,[],'browser JavaScript errors');
  assert.deepEqual(writes.filter(x=>!x.includes('/api/verify')),[],'unapproved browser mutation');
  const result={status:'PASS',platform,version:health.version,host:state.computer,cases:checks.length,
    screenshotProjects:3,installedCount:state.apps.filter(a=>a.installedVersion).length,
    canRequestInstall:state.apps.some(a=>a.installable),
    validAccessChecks:true,verifyAction:true,onlyApprovedWrite:'/api/verify',
    nativeGUI:'validated separately',checks,errors,external,writes};
  fs.writeFileSync(path.join(dir,'live-qa.json'),JSON.stringify(result,null,2));
  console.log('CHALLENGER_FOCUS_LIVE_QA_PASS '+JSON.stringify({
   platform,resultCases:checks.length,projects:3,errors:0,external:0,installed:result.installedCount,verify:true}));
 }finally{await browser.close()}
})().catch(e=>{console.error('CHALLENGER_FOCUS_LIVE_QA_FAIL',e.stack);process.exitCode=1});
