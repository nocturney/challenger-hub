'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),
 puppeteer=require('C:/Users/Chris/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const base='http://127.0.0.1:'+Number(process.env.CHALLENGER_V9_QA_PORT||19099)+'/',
 out=path.join(__dirname,'dist','qa-catalog-preview9');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const s=await fetch(base+'api/state').then(r=>r.json());
 assert.equal(s.apps.length,14);assert.equal(s.discoveries.length,152);
 assert.deepEqual({archived:s.registryStatus.health.archived,quiet12mo:s.registryStatus.health.quiet12mo,
  quiet6mo:s.registryStatus.health.quiet6mo}, {archived:1,quiet12mo:5,quiet6mo:1});
 const flowise=s.discoveries.find(x=>x.repo==='flowise');
 assert.equal(flowise.repositoryHealth.state,'archived');
 assert.equal(s.discoveries.find(x=>x.repo==='olive').repositoryHealth.state,'quiet-12m');
 assert.equal(s.apps.find(x=>x.repo==='cadcraft').installEvidence.mayAutoReplace,false);
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage(),errors=[],remote=[],mutations=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
 page.on('request',e=>{
  if(e.url().startsWith(base)){if(!['GET','HEAD'].includes(e.method()))mutations.push(e.url())}
  else if(!e.url().startsWith('about:'))remote.push(e.url());
 });
 try{
  await page.setViewport({width:1100,height:760});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#connectionState')?.classList.contains('connected'),{timeout:17000});
  assert.match(await page.$eval('#hubVersion',e=>e.textContent),/Preview 9/);
  const count=await page.$eval('#homeProjectCount',e=>e.textContent);
  assert.ok(count.includes('81 DOCUMENTED / MANAGED')&&count.includes('85 NEED MORE RESEARCH'),count);
  await page.evaluate(()=>goBrowse({domain:'all'}));
  await page.waitForSelector('#candidateWatchToggle',{timeout:12000});
  await page.click('#candidateWatchToggle');
  await page.waitForFunction(()=>document.querySelectorAll('.candidate-card').length===14,{timeout:7000});
  const candidates=await page.evaluate(()=>[...document.querySelectorAll('.candidate-card')].map(x=>({
   name:x.querySelector('strong')?.textContent,source:x.querySelector('a')?.href,
   why:x.querySelector('.candidate-reason')?.textContent,installed:x.querySelector('button[data-operation]')!==null
  })));
  assert.ok(candidates.some(x=>x.name==='DCC-MCP Core'));
  assert.ok(candidates.some(x=>x.name==='SolidCraft'));
  assert.ok(candidates.every(x=>x.source?.startsWith('https://github.com/')&&!x.installed));
  await page.screenshot({path:path.join(out,'preview9-new-candidates-research-only.png'),fullPage:true});
  await page.$eval('#exploreSearch',e=>{e.value='Flowise'});
  await page.$eval('#exploreSearchForm',f=>f.requestSubmit());
  await page.waitForFunction(()=>document.querySelector('#exploreEmpty')&&!document.querySelector('#exploreEmpty').hidden,{timeout:8500});
  assert.equal(await page.$eval('#exploreRows',x=>x.querySelectorAll('[data-project="flowise"]').length),0);
  await page.click('#researchToggle');
  await page.waitForSelector('#exploreRows [data-project="flowise"]',{timeout:8500});
  const label=await page.$eval('#exploreRows [data-project="flowise"]',x=>x.closest('tr')?.textContent);
  assert.match(label,/ARCHIVED upstream/);
  await page.click('#exploreRows [data-project="flowise"]');
  await page.waitForFunction(()=>document.querySelector('.doc-aside')?.textContent.includes('GitHub repository archived'),{timeout:7000});
  await page.screenshot({path:path.join(out,'preview9-archived-flowise-transparent.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);assert.deepEqual(mutations,[]);
  console.log('PREVIEW9_CATALOG_BROWSER_PASS '+JSON.stringify({existing:152,archived:1,quiet12mo:5,
   newCandidates:candidates.length,visibleNormal:81,researchHidden:85,errors:0,external:0,mutations:0}));
 }finally{await browser.close()}
})().catch(e=>{console.error('PREVIEW9_CATALOG_BROWSER_FAIL',e.stack||e);process.exitCode=1});
