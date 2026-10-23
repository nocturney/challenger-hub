'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const puppeteer=require('C:/Users/Chris/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const port=Number(process.env.CHALLENGER_V8_QA_PORT||19088),base='http://127.0.0.1:'+port+'/';
const out=path.join(__dirname,'dist','qa-preview8-shell');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const api=await fetch(base+'api/state').then(r=>r.json());
 const tally=api.discoveries.reduce((acc,p)=>(acc[p.profileTier]=(acc[p.profileTier]||0)+1,acc),{});
 assert.equal(api.apps.length,14);
 assert.equal(api.discoveries.length,152);
 assert.deepEqual(tally,{'documented':72,'needs-details':7,research:73});
 assert.equal(api.discoveries.filter(p=>!!p.sourceDescription).length,152);
 assert.equal(api.discoveries.filter(p=>!!p.officialLicense).length,101);
 assert.ok(api.discoveries.find(x=>x.repo==='baserow').profileTier==='documented');
 assert.ok(api.discoveries.find(x=>x.repo==='dune3d').profileTier==='needs-details');
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage(),errors=[],external=[],writes=[],layouts=[];
 page.on('pageerror',err=>errors.push(err.message));
 page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
 page.on('request',req=>{
  if(req.url().startsWith(base)){
   if(!['GET','HEAD'].includes(req.method()))writes.push(req.method()+' '+req.url());
  }else if(!req.url().startsWith('about:'))external.push(req.url());
 });
 try {
  for(const [width,height] of [[1100,740],[920,600],[780,540],[1366,768],[430,800]]){
   await page.setViewport({width,height,deviceScaleFactor:1});
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.getElementById('connectionState')?.classList.contains('connected'),{timeout:14000});
   const m=await page.evaluate(()=>({
    viewport:[innerWidth,innerHeight],
    pageScrollHeight:document.documentElement.scrollHeight,
    mainScrollHeight:document.querySelector('#main').scrollHeight,
    mainClientHeight:document.querySelector('#main').clientHeight,
    headerTop:Math.round(document.querySelector('.global-header').getBoundingClientRect().top),
    footerBottom:Math.round(document.querySelector('.global-footer').getBoundingClientRect().bottom),
    searchBottom:Math.round(document.querySelector('.hero-search').getBoundingClientRect().bottom),
    firstCategoryBottom:Math.round(document.querySelector('.discipline-row').getBoundingClientRect().bottom),
    categoryCount:document.querySelectorAll('.discipline-row').length,
    label:document.getElementById('homeProjectCount')?.textContent,
    overflowX:document.documentElement.scrollWidth>innerWidth+1,
    homeScroll:document.getElementById('homeScreen').scrollHeight>document.getElementById('homeScreen').clientHeight+2
   }));
   assert.ok(!m.overflowX,'Horizontal overflow '+JSON.stringify(m));
   assert.ok(m.footerBottom<=height+2,'Bottom controls clipped by parent scroll '+JSON.stringify(m));
   assert.ok(m.categoryCount===17);
   assert.ok(m.label.includes('DOCUMENTED / MANAGED')&&m.label.includes('81 NEED MORE RESEARCH'));
   if(width>=720){
    assert.ok(m.pageScrollHeight<=height+2,'Page itself scrolls after window resize '+JSON.stringify(m));
    assert.ok(m.searchBottom<height*.8,'Search hidden under fold '+JSON.stringify(m));
    assert.ok(m.firstCategoryBottom<height-10,'Browse entry hidden after resize '+JSON.stringify(m));
   }
   if(width===1100||width===780)await page.screenshot({
    path:path.join(out,'challenger-viewport-'+width+'x'+height+'.png')});
   layouts.push(m);
  }
  await page.setViewport({width:1100,height:740});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('connectionState')?.classList.contains('connected'));
  await page.$eval('#homeSearch',el=>{el.value='Dune 3D'});
  await page.$eval('#homeSearchForm',form=>form.requestSubmit());
  await page.waitForSelector('#researchToggle');
  let before=await page.evaluate(()=>({
   rows:document.querySelectorAll('#exploreRows [data-project="dune3d"]').length,
   toggle:document.getElementById('researchToggle').getAttribute('aria-pressed'),
   message:document.getElementById('exploreEmpty').textContent
  }));
  assert.equal(before.rows,0,'Incomplete profile improperly shown by default');
  assert.equal(before.toggle,'false');
  assert.ok(before.message.includes('No documented match'));
  await page.click('#researchToggle');
  await page.waitForSelector('#exploreRows [data-project="dune3d"]');
  assert.equal(await page.$eval('#researchToggle',el=>el.getAttribute('aria-pressed')),'true');
  await page.click('#exploreRows [data-project="dune3d"]');
  await page.waitForSelector('.source-profile-evidence');
  const missing=await page.evaluate(()=>document.querySelector('.doc-aside')?.textContent||'');
  assert.ok(missing.includes('Supported platforms')&&missing.includes('Not approved'));
  await page.screenshot({path:path.join(out,'research-opt-in-dune3d.png')});
  await page.click('#brandHome');
  await page.$eval('#homeSearch',el=>{el.value='Baserow'});
  await page.$eval('#homeSearchForm',form=>form.requestSubmit());
  await page.waitForSelector('#exploreRows [data-project="baserow"]');
  await page.click('#exploreRows [data-project="baserow"]');
  await page.waitForFunction(()=>document.querySelector('.source-profile-evidence .source-facts') &&
   document.querySelector('.vetted-source-gallery img')?.naturalWidth>400,{timeout:30000});
  const doc=await page.evaluate(()=>({
   facts:document.querySelector('.source-profile-evidence')?.textContent,
   source:document.querySelector('.vetted-source-gallery a')?.href,
   status:document.querySelector('.doc-aside')?.textContent
  }));
  assert.ok(doc.facts.includes('Official repository description'));
  assert.ok(doc.facts.includes('Latest observed published release'));
  assert.ok(doc.facts.includes('GitHub stars at last check'));
  assert.ok(doc.source.startsWith('https://github.com/baserow/baserow/blob/'));
  assert.ok(doc.status.includes('Not approved'));
  await page.screenshot({path:path.join(out,'baserow-documented-profile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
  assert.deepEqual(writes,[]);
  console.log('PREVIEW8_SHELL_PROFILE_QA_PASS '+JSON.stringify({tally,layouts,sourceDescriptions:152,
   officialLicenses:101,entryResearchOptIn:true,documentedBaserow:true,errors:0,external:0,writes:0}));
 }finally{await browser.close()}
})().catch(e=>{console.error('PREVIEW8_SHELL_PROFILE_QA_FAIL',e.stack||e);process.exitCode=1});
