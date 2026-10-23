'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const mac=process.platform==='darwin';
const base=mac?'/Users/chris/Library/Application Support/OfficeOps/CraftSuite':'D:/Velvet/Installers/CraftSuite';
const root=path.join(base,'Center','Challenger-FocusOrbit-PREVIEW-4.0.0-orbit.1');
const puppeteer=require(mac?'/Users/chris/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer':'C:/Users/Chris/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const url='http://127.0.0.1:17961/';
(async()=>{
 const state=await fetch(url+'api/state').then(x=>x.json());
 assert.equal(state.apps.length,12);assert.equal(state.discoveries.length,152);
 assert.equal(state.previewMode,'offline-cache');
 assert.equal(state.discoveries.filter(x=>x.researchPendingVerification).length,73);
 assert.equal((await fetch(url+'api/health')).status,200);
 for(const method of ['POST','PUT','DELETE']){
  const r=await fetch(url+'api/state',{method});
  assert.equal(r.status,405,'mutating HTTP method accidentally allowed');
 }
 for(const p of ['api/install','api/update-all','api/scan','server.js','../server.js']){
  const r=await fetch(url+p);
  assert.equal(r.status,404,'unsupported route '+p);
 }
 const b=await puppeteer.launch({headless:true,executablePath:mac?'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge':undefined,args:['--no-sandbox','--disable-gpu']});
 const page=await b.newPage(),errors=[],writes=[],report=[];
 page.on('pageerror',e=>errors.push(String(e.message)));
 page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
 page.on('request',e=>{if(!['GET','HEAD'].includes(e.method()))writes.push(e.method()+' '+e.url())});
 try{
  const out=path.join(root,'_qa');fs.mkdirSync(out,{recursive:true});
  for(const width of [1590,1040,768,430,320]){
   await page.setViewport({width,height:930,deviceScaleFactor:1});
   await page.goto('about:blank');
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
   await page.waitForFunction(()=>document.querySelectorAll('.discipline-row').length===17,{timeout:13000});
   for(const theme of ['light','dark']){
    await page.evaluate(x=>{if(document.documentElement.dataset.theme!==x)document.getElementById('themeSwitch').click()},theme);
    const i=await page.evaluate(()=>({
     pageW:document.documentElement.scrollWidth,bodyW:document.body.scrollWidth,view:innerWidth,
     orbit:document.querySelector('img.brand-mark-light')?.naturalWidth>0&&document.querySelector('img.brand-mark-dark')?.naturalWidth>0,
     archived:document.getElementById('connectionState').textContent.includes('Archived catalog'),
     banner:document.querySelector('.test-release-strip')?.textContent.includes('NOT LIVE'),
     n:document.querySelectorAll('.discipline-row').length,
     status:document.getElementById('sourceNotice').textContent
    }));
    assert.ok(i.pageW<=width+1&&i.bodyW<=width+1,'horizontal overflow '+JSON.stringify(i));
    assert.ok(i.orbit&&i.archived&&i.banner&&i.n===17,'archive/brand integration '+JSON.stringify(i));
    assert.ok(i.status.includes('OFFLINE PREVIEW'),'snapshot must be labeled');
    await page.screenshot({path:path.join(out,'preview-'+theme+'-'+width+'.png')});
    report.push({width,theme,ok:true});
   }
   if(width===1590){
    await page.evaluate(()=>{if(document.documentElement.dataset.theme!=='light')document.getElementById('themeSwitch').click()});
    await page.click('[data-domain="3D & Manufacturing"]');
    let n=await page.$eval('#resultCount',e=>Number(e.textContent));
    assert.equal(n,28,'category 3D result count');
    await page.screenshot({path:path.join(out,'preview-results-3d.png')});
    await page.click('#exploreRows .project-hit');
    assert.ok(await page.$eval('#projectScreen',e=>!e.hidden),'project dossier');
    await page.screenshot({path:path.join(out,'preview-project-dossier.png')});
    await page.click('[data-main="library"]');
    assert.equal(await page.$$eval('#libraryRows tr',x=>x.length),0,'offline build must not invent installed status');
    assert.ok((await page.$eval('#libraryEmpty',x=>x.textContent)).includes('Live installed software unavailable'),'missing honest offline library state');
    await page.screenshot({path:path.join(out,'preview-my-software.png')});
    await page.click('[data-main="activity"]');
    const activity=await page.evaluate(()=>({running:document.getElementById('runningNumber').textContent,history:document.getElementById('historyRows').textContent}));
    assert.equal(activity.running,'—','no fake running count');
    assert.ok(activity.history.includes('not part of the archived catalog'),'no fake history');
    await page.screenshot({path:path.join(out,'preview-activity-offline.png')});
    await page.click('[data-main="home"]');
    await page.focus('#homeSearch');await page.keyboard.type('Photoshop');await page.keyboard.press('Enter');
    n=await page.$eval('#resultCount',e=>Number(e.textContent));
    assert.equal(n,5,'Photoshop archived search result count');
    await page.screenshot({path:path.join(out,'preview-search-photoshop.png')});
   }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  const manifest={status:'PASS',platform:process.platform,release:'4.0.0-orbit.preview.1',
    widths:[1590,1040,768,430,320],screenshotCount:report.length+5,archivedProjects:164,restrictedResearch:73,
    readOnly:true,noWrites:true,errors,writes};
  fs.writeFileSync(path.join(out,'browser-qa.json'),JSON.stringify(manifest,null,2));
  console.log('FOCUS_ORBIT_OFFLINE_PREVIEW_QA_PASS',JSON.stringify(manifest));
 }finally{await b.close()}
})().catch(e=>{console.error('FOCUS_ORBIT_OFFLINE_PREVIEW_QA_FAIL',e.stack);process.exitCode=1});
