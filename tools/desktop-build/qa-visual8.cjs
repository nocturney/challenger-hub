'use strict';
/* Actual Chromium visual acceptance: version visible, self-update, viewport fit, official README media.
   Only GETs: never requests installs or updates. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const puppeteer=require('C:/Users/Chris/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const port=Number(process.env.CHALLENGER_V8_QA_PORT||19077),base='http://127.0.0.1:'+port+'/';
const out=path.join(__dirname,'dist','qa-v8-visible-ui');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage(),errors=[],external=[],writes=[],sizes=[];
 page.on('pageerror',x=>errors.push(String(x.message)));
 page.on('console',x=>{if(x.type()==='error')errors.push(x.text())});
 page.on('request',x=>{
  if(x.url().startsWith(base)&&!['GET','HEAD'].includes(x.method()))writes.push(x.method()+' '+x.url());
  else if(!x.url().startsWith(base)&&!x.url().startsWith('about:'))external.push(x.url());
 });
 try{
  for(const [w,h] of [[1366,768],[1200,700],[1590,900],[430,850]]){
   await page.setViewport({width:w,height:h,deviceScaleFactor:1});
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('.connection-state.connected')&&
    document.getElementById('hubVersion')?.textContent.includes('Preview 8'),{timeout:15000});
   const m=await page.evaluate(()=>({
    viewport:[innerWidth,innerHeight],appVersion:document.querySelector('#hubVersion').textContent,
    header:Math.round(document.querySelector('.global-header').getBoundingClientRect().bottom),
    searchBottom:Math.round(document.querySelector('.hero-search').getBoundingClientRect().bottom),
    directoryTop:Math.round(document.querySelector('.home-directory').getBoundingClientRect().top),
    firstRowBottom:Math.round(document.querySelector('.discipline-row').getBoundingClientRect().bottom),
    overflow:document.documentElement.scrollWidth>innerWidth+1,
    contentWidth:document.querySelector('#main').getBoundingClientRect().width
   }));
   assert.ok(!m.overflow,'Horizontal viewport overflow: '+JSON.stringify(m));
   if(w>=1200){
    assert.ok(m.directoryTop<h*.78,'Home categories hidden beneath fold: '+JSON.stringify(m));
    assert.ok(m.firstRowBottom<h-25,'Initial app viewport hides all actionable categories: '+JSON.stringify(m));
   }
   sizes.push(m);
   if(w===1366)await page.screenshot({path:path.join(out,'home-1366x768.png')});
   if(w===1200)await page.screenshot({path:path.join(out,'home-1200x700.png')});
  }
  await page.setViewport({width:1366,height:768});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('.connection-state.connected'));
  await page.click('#hubCheckUpdates');
  await page.waitForFunction(()=>document.getElementById('hubUpdateState').textContent.match(/Hub is current|Preview [0-9]+ available|update check unavailable/i),{timeout:25000});
  const hub=await page.evaluate(()=>({
   version:document.getElementById('hubVersion').textContent,
   message:document.getElementById('hubUpdateState').textContent,
   link:document.getElementById('hubUpdateLink')?.getAttribute('href')
  }));
  assert.ok(/Preview 8/.test(hub.version));
  assert.ok(/Hub is current|Preview [0-9]+ available/.test(hub.message),'Native Hub update API not wired: '+hub.message);
  await page.$eval('#homeSearch',(e)=>{e.value='Baserow'});
  await page.$eval('#homeSearchForm',f=>f.requestSubmit());
  await page.waitForSelector('#exploreRows [data-project="baserow"]',{timeout:15000});
  const avatar=await page.evaluate(()=>document.querySelector('#exploreRows .creator-avatar img')?.getAttribute('src'));
  assert.ok(avatar?.startsWith('/api/repository-media/avatar?repo='),'No official creator avatar in browse rows');
  await page.click('#exploreRows [data-project="baserow"]');
  await page.waitForFunction(()=>document.querySelector('.vetted-source-gallery img.project-screenshot')?.complete&&
    document.querySelector('.vetted-source-gallery img.project-screenshot')?.naturalWidth>400,{timeout:30000});
  const media=await page.evaluate(()=>({
   figure:document.querySelector('.vetted-source-gallery figcaption')?.textContent,
   alt:document.querySelector('.vetted-source-gallery img')?.alt,
   src:document.querySelector('.vetted-source-gallery img')?.getAttribute('src'),
   original:document.querySelector('.vetted-source-gallery a')?.href,
   ownerAvatar:document.querySelector('.project-title-cluster .creator-avatar')?.title
  }));
  assert.ok(media.figure?.includes('SCREENSHOT IN PROJECT SOURCE REPOSITORY'));
  assert.ok(media.original?.startsWith('https://github.com/baserow/baserow/blob/'));
  assert.ok(media.src.includes('/api/repository-media/official-screenshot?repo=baserow'));
  assert.ok(media.ownerAvatar?.includes('not an official product logo'));
  await page.screenshot({path:path.join(out,'baserow-official-readme-1366.png'),fullPage:true});
  assert.equal(errors.length,0,JSON.stringify(errors));
  assert.equal(external.length,0,'Unexpected external browser requests');
  assert.equal(writes.length,0,'No system-changing POST allowed');
  console.log('PREVIEW8_VISUAL_ACCEPTANCE_PASS '+JSON.stringify({sizes,hub,media,errorCount:0,externalRequests:0}));
 }finally{await browser.close()}
})().catch(e=>{console.error('PREVIEW8_VISUAL_ACCEPTANCE_FAILED',e.stack||e);process.exitCode=1});
