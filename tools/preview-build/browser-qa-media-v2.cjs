'use strict';
/* Real-browser visual and contract checks for isolated Focus+Orbit Preview 2. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const mac=process.platform==='darwin';
const base=mac?'/Users/chris/Library/Application Support/OfficeOps/CraftSuite':'D:/Velvet/Installers/CraftSuite';
const root=path.join(base,'Center','Challenger-FocusOrbit-PREVIEW-4.0.0-orbit.2');
const puppeteer=require(mac?'/Users/chris/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer':
 'C:/Users/Chris/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const url='http://127.0.0.1:17962/';
(async()=>{
 const state=await fetch(url+'api/state').then(x=>x.json());
 assert.equal(state.previewMode,'offline-cache');
 assert.equal(state.apps.length,12);
 assert.equal(state.discoveries.length,152);
 assert.equal(state.discoveries.filter(p=>p.researchPendingVerification).length,73);
 const health=await fetch(url+'api/health').then(r=>r.json());
 assert.equal(health.mode,'READ_ONLY_OFFLINE_PREVIEW');
 assert.equal(health.version,'4.0.0-orbit.preview.2');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'test-manifest.json'),'utf8'));
 assert.ok(manifest.media.icons>=1&&manifest.media.screenshots>=1);
 for(const method of ['POST','PUT','PATCH','DELETE']){
  assert.equal((await fetch(url+'api/state',{method})).status,405);
 }
 for(const endpoint of ['api/install','api/scan','server.js','../server.js','media/icons/../../server.js']){
  const response=await fetch(url+endpoint);assert.equal(response.status,404,'forbidden path served '+endpoint);
 }
 const browser=await puppeteer.launch({headless:true,
  executablePath:mac?'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge':undefined,
  args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage(),errors=[],writes=[],external=[],report=[];
 page.on('pageerror',e=>errors.push(String(e.message)));
 page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
 page.on('request',e=>{
  if(!['GET','HEAD'].includes(e.method()))writes.push(e.method()+' '+e.url());
  if(!e.url().startsWith(url)&&!e.url().startsWith('about:'))external.push(e.url());
 });
 const out=path.join(root,'_qa');fs.mkdirSync(out,{recursive:true});
 try{
  for(const width of [1590,1040,768,430,320]){
   await page.setViewport({width,height:960,deviceScaleFactor:1});
   for(const theme of ['light','dark']){
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForFunction(()=>document.querySelectorAll('.discipline-row').length===17,{timeout:14000});
    if(theme==='dark')await page.click('#themeSwitch');
    let state=await page.evaluate(()=>({
     width:innerWidth,scroll:document.documentElement.scrollWidth,
     categoryIcons:document.querySelectorAll('.discipline-row .discipline-icon').length,
     archived:document.querySelector('.test-release-strip')?.textContent.includes('NOT LIVE'),
     brand:document.querySelector('img.brand-mark-light')?.naturalWidth>0 &&
      document.querySelector('img.brand-mark-dark')?.naturalWidth>0
    }));
    assert.ok(state.scroll<=width+1,'home overflow '+JSON.stringify(state));
    assert.equal(state.categoryIcons,17,'missing category icon');
    assert.ok(state.archived&&state.brand,'not marked archived / missing Orbit logo');
    await page.screenshot({path:path.join(out,'preview-v2-home-'+theme+'-'+width+'.png')});
    await page.click('[data-domain="3D & Manufacturing"]');
    assert.equal(await page.$eval('#resultCount',e=>Number(e.textContent)),28);
    const rowIcons=await page.$$eval('#exploreRows .project-hit .project-icon-frame',nodes=>nodes.length);
    assert.ok(rowIcons>=28,'missing row icon / fallback');
    if(width===1590)await page.screenshot({path:path.join(out,'preview-v2-3d-results-'+theme+'.png')});
    await page.$eval('#exploreSearch',e=>{e.value='Dune 3D';e.dispatchEvent(new Event('input',{bubbles:true}))});
    await page.waitForFunction(()=>document.querySelectorAll('#exploreRows .project-hit').length>=1);
    const button=await page.$('#exploreRows .project-hit');
    assert.ok(button,'Dune 3D not searchable');
    await button.click();
    assert.ok(await page.$eval('#projectScreen',e=>!e.hidden),'Dune dossier did not open');
    await page.waitForFunction(()=>{
     const img=document.querySelector('.project-screenshot');
     return img&&img.complete&&img.naturalWidth>=600;
    },{timeout:12000});
    const dossier=await page.evaluate(()=>({
     overflow:document.documentElement.scrollWidth>innerWidth+1,
     screenshot:document.querySelector('.project-screenshot')?.naturalWidth||0,
     src:document.querySelector('.project-screenshot')?.getAttribute('src'),
     caption:document.querySelector('.project-media-figure figcaption')?.textContent||'',
     icon:document.querySelector('.project-identity .official-project-icon')?.naturalWidth||0,
     previewNotLive:document.querySelector('.test-release-strip')?.textContent.includes('NOT LIVE'),
     status:document.querySelector('.project-identity-status')?.textContent||''
    }));
    assert.ok(!dossier.overflow,'dossier overflow '+JSON.stringify(dossier));
    assert.ok(dossier.icon>0&&dossier.screenshot>=600,'official icon/real screenshot missing '+JSON.stringify(dossier));
    assert.ok(dossier.src==='/media/screenshots/dune3d.png');
    assert.ok(dossier.caption.includes('ACTUAL APPLICATION SCREENSHOT')&&dossier.caption.includes('Official source'));
    assert.ok(dossier.previewNotLive);
    await page.screenshot({path:path.join(out,'preview-v2-dune3d-dossier-'+theme+'-'+width+'.png'),fullPage:width===1590});
    report.push({width,theme,status:'PASS',dossier});
   }
  }
  assert.deepEqual(errors,[],'browser JavaScript errors');
  assert.deepEqual(writes,[],'browser mutation requests');
  assert.deepEqual(external,[],'unexpected external browser requests');
  const summary={status:'PASS',platform:process.platform,release:'4.0.0-orbit.preview.2',
   cases:report.length,categoryIcons:17,icons:manifest.media.icons,screenshots:manifest.media.screenshots,
   archivedProjects:164,restrictedResearch:73,readOnly:true,noWrites:true,externalRequests:0,
   screenshotsCaptured:report.length*2+2,report,errors,writes};
  fs.writeFileSync(path.join(out,'browser-qa-media-v2.json'),JSON.stringify(summary,null,2));
  console.log('FOCUS_ORBIT_MEDIA_V2_QA_PASS '+JSON.stringify({
   platform:summary.platform,cases:summary.cases,icons:summary.icons,screenshots:summary.screenshots,
   browserImages:summary.screenshotsCaptured,readOnly:true,errors:summary.errors.length}));
 }finally{await browser.close()}
})().catch(e=>{console.error('FOCUS_ORBIT_MEDIA_V2_QA_FAIL',e.stack);process.exitCode=1});
