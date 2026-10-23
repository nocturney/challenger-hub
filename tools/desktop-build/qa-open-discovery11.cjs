'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),
 puppeteer=require('C:/Users/Chris/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const port=Number(process.env.CHALLENGER_V11_QA_PORT||19110),base='http://127.0.0.1:'+port+'/';
const out=path.join(__dirname,'dist','qa-open-discovery10');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const data=await fetch(base+'api/state').then(r=>r.json());
 assert.equal(data.apps.length,14);assert.equal(data.discoveries.length,152);
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage(),errors=[],external=[],writes=[],automaticChecks=[];
 page.on('pageerror',e=>errors.push(String(e.message)));
 page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
 page.on('request',r=>{
  if(r.url().startsWith(base)){
   if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());
   if(r.url().includes('/api/hub-update'))automaticChecks.push(r.url());
  }else if(!r.url().startsWith('about:'))external.push(r.url());
 });
 try {
  await page.setViewport({width:1100,height:760});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#connectionState')?.classList.contains('connected') &&
   document.querySelector('#homeProjectCount')?.textContent.includes('181 SOURCE-LINKED'),{timeout:16000});
  const doc=await page.evaluate(()=>({
   footerVersion:document.querySelector('.global-footer #hubVersion')?.textContent,
   headHub:document.querySelector('.global-header #hubVersion'),
   headerStatus:document.querySelector('.global-header #connectionState')?.getBoundingClientRect().width,
   footerUpdate:!!document.querySelector('.global-footer #hubCheckUpdates'),
   initialStatus:document.querySelector('#hubUpdateState')?.textContent,
   n:projects.length,newCount:projects.filter(x=>x.candidateWatch).length,
   official:projects.filter(x=>!x.candidateWatch&&x.discovery).length,
   managed:projects.filter(x=>!x.discovery).length,
   researchToggle:!!document.querySelector('#researchToggle'),
   gen:projects.find(x=>x.repo==='candidate-genspark-ai-genoffice')?.repoUrl
  }));
  assert.match(doc.footerVersion,/Preview 11/);
  assert.equal(doc.headHub,null);
  assert.equal(doc.headerStatus,0);
  assert.equal(doc.n,181);
  assert.equal(doc.newCount,15);
  assert.equal(doc.official,152);
  assert.equal(doc.managed,14);
  assert.equal(doc.researchToggle,false);
  assert.equal(doc.gen,'https://github.com/genspark-ai/genoffice');
  assert.equal(doc.initialStatus,'Not checked');
  await page.evaluate(()=>refresh());
  await page.waitForFunction(()=>projects.length===181&&projects.filter(x=>x.candidateWatch).length===15);
  await page.evaluate(()=>refresh());
  assert.equal(await page.evaluate(()=>projects.filter(x=>x.candidateWatch).length),15,'Refresh must not hide or duplicate new candidates');
  await new Promise(resolve=>setTimeout(resolve,2900));
  assert.deepEqual(automaticChecks,[],'No automatic startup GitHub calls or shifting Hub status');
  await page.evaluate(()=>goBrowse({domain:'all'}));
  const reported=await page.$eval('#resultCount',e=>e.textContent);
  assert.equal(reported,'181');
  await page.$eval('#exploreSearch',e=>{e.value='Flowise'});
  await page.$eval('#exploreSearchForm',e=>e.requestSubmit());
  await page.waitForSelector('#exploreRows [data-project="flowise"]',{timeout:8000});
  const archived=await page.$eval('#exploreRows [data-project="flowise"]',e=>e.closest('tr').textContent);
  assert.match(archived,/ARCHIVED upstream/,'Archived remains visible, not hidden');
  await page.$eval('#exploreSearch',e=>{e.value='Dune 3D'});
  await page.$eval('#exploreSearchForm',e=>e.requestSubmit());
  await page.waitForSelector('#exploreRows [data-project="dune3d"]',{timeout:8000});
  const dune=await page.$eval('#exploreRows [data-project="dune3d"]',e=>e.closest('tr').textContent);
  assert.match(dune,/Details evolving/,'Incomplete source is searchable without opt-in');
  await page.$eval('#exploreSearch',e=>{e.value='GenOffice'});
  await page.$eval('#exploreSearchForm',e=>e.requestSubmit());
  await page.waitForSelector('#exploreRows [data-project="candidate-genspark-ai-genoffice"]',{timeout:8000});
  const gen=await page.$eval('#exploreRows [data-project="candidate-genspark-ai-genoffice"]',e=>e.closest('tr').textContent);
  assert.match(gen,/New find/);
  await page.click('#exploreRows [data-project="candidate-genspark-ai-genoffice"]');
  const go=await page.evaluate(()=>({
   title:document.querySelector('.project-name')?.textContent,
   source:document.querySelector('.project-identity-status a')?.href,
   install:[...document.querySelectorAll('#projectScreen [data-operation]')].filter(x=>/install|download-portable|update/i.test(x.dataset.operation)).length,
   detail:document.querySelector('#projectDocument')?.textContent.slice(0,3000)
  }));
  assert.equal(go.title,'GenOffice');
  assert.equal(go.source,'https://github.com/genspark-ai/genoffice');
  assert.equal(go.install,0);
  assert.match(go.detail,/Information is incomplete, but this project is fully discoverable/);
  await page.screenshot({path:path.join(out,'genoffice-source-linked-dossier.png'),fullPage:true});
  await page.evaluate(()=>goBrowse({domain:'all',query:''}));
  await page.click('#filterToggle');
  await page.waitForSelector('#filterPanel:not([hidden])');
  await page.click('[data-scope="new"]');
  await page.waitForFunction(()=>document.querySelector('#resultCount')?.textContent==='15');
  const allNew=await page.$$eval('#exploreRows [data-project]',els=>els.map(x=>x.dataset.project));
  assert.equal(allNew.length,15);
  assert.ok(allNew.includes('candidate-genspark-ai-genoffice'));
  assert.ok(allNew.includes('candidate-dcc-mcp-dcc-mcp-core'));
  await page.screenshot({path:path.join(out,'all-15-new-finds-searchable.png'),fullPage:true});
  for(const [width,height] of [[1100,760],[920,600],[780,540],[430,850]]){
   await page.setViewport({width,height});
   await page.evaluate(()=>goHome());
   await page.waitForSelector('#homeScreen:not([hidden])');
   const geo=await page.evaluate(()=>({
    inner:[innerWidth,innerHeight],
    head:document.querySelector('.global-header').getBoundingClientRect().width,
    footerY:document.querySelector('.global-footer').getBoundingClientRect().top,
    footerEnd:document.querySelector('.global-footer').getBoundingClientRect().bottom,
    pageX:document.documentElement.scrollWidth,
    checkFooter:document.querySelector('.global-footer #hubCheckUpdates')?.getBoundingClientRect().width,
    searchEnd:document.querySelector('#homeSearch').getBoundingClientRect().bottom
   }));
   assert.ok(geo.pageX<=width+1,'Horizontal overflow '+JSON.stringify(geo));
   assert.ok(geo.footerEnd<=height+2&&geo.footerY>height-70,'Footer jumps '+JSON.stringify(geo));
   assert.ok(geo.checkFooter>30);
   if(width>=780)assert.ok(geo.searchEnd<height*.75,'Search lost after shrinking');
   if(width===780)await page.screenshot({path:path.join(out,'no-local-banner-footer-780x540.png')});
  }
  await page.evaluate(()=>{
   document.getElementById('connectionState').textContent='LOCAL DATA · ever-changing signal would have previously shifted all header buttons';
  });
  const jitter=await page.evaluate(()=>({
   title:document.querySelector('.brand').getBoundingClientRect().left,
   nav:document.querySelector('.primary-nav').getBoundingClientRect().left,
   utilities:document.querySelector('.header-utilities').getBoundingClientRect().left,
   visible:getComputedStyle(document.querySelector('.global-header #connectionState')).display
  }));
  assert.equal(jitter.visible,'none');
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
  assert.deepEqual(writes,[]);
  console.log('PREVIEW11_OPEN_DISCOVERY_QUIET_FOOTER_PASS '+JSON.stringify({
   entries:181,managed:14,independent:152,newFinds:15,archivedVisible:true,
   incompleteVisible:true,genOfficeSearch:true,noInstallerForNew:true,
   footerStable:true,unwantedAutomaticHubChecks:automaticChecks.length,
   errors:0,externalRequests:0,writes:0}));
 }finally{await browser.close()}
})().catch(e=>{console.error('PREVIEW11_OPEN_DISCOVERY_QUIET_FOOTER_FAIL',e.stack||e);process.exitCode=1});
