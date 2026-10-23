'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const puppeteer=require('C:/Users/Chris/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const port=Number(process.env.CHALLENGER_V9_QA_PORT||19088),base='http://127.0.0.1:'+port+'/';
const out=path.join(__dirname,'dist','qa-preview9-craft-media');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage(),errors=[],external=[],writes=[];
 page.on('pageerror',x=>errors.push(String(x.message)));
 page.on('console',x=>{if(x.type()==='error')errors.push(x.text())});
 page.on('request',x=>{
  if(x.url().startsWith(base)){
   if(!['GET','HEAD'].includes(x.method()))writes.push(x.method()+' '+x.url());
  }else if(!x.url().startsWith('about:'))external.push(x.url());
 });
 try{
  await page.setViewport({width:1100,height:740});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('connectionState')?.classList.contains('connected'),{timeout:14000});
  assert.ok((await page.$eval('#homeProjectCount',e=>e.textContent)).includes('81 DOCUMENTED / MANAGED · 85 NEED MORE RESEARCH'));
  for(const id of ['cadcraft','photocraft','figcraft','pdfcraft']){
   await page.$eval('#homeSearch',(e,id)=>{e.value=id},id);
   await page.$eval('#homeSearchForm',f=>f.requestSubmit());
   await page.waitForSelector('#exploreRows [data-project="'+id+'"]',{timeout:14000});
   const row=await page.$eval('#exploreRows [data-project="'+id+'"]',e=>({
    icon:e.querySelector('img.official-project-icon')?.getAttribute('src')
   }));
   assert.equal(row.icon,'/media/craft/icons/'+id+'.png','Original licensed Craft icon not found: '+id);
   await page.click('#exploreRows [data-project="'+id+'"]');
   await page.waitForFunction((id)=>{
    const img=document.querySelector('.craft-product-gallery .project-screenshot');
    const icon=document.querySelector('.project-identity .official-project-icon');
    return document.querySelector('.project-name')?.textContent.toLowerCase()===id&&
      img?.complete&&img.naturalWidth>=720&&icon?.complete&&icon.naturalWidth>=80;
   },{timeout:16000},id);
   const metrics=await page.evaluate(()=>({
    src:document.querySelector('.craft-product-gallery .project-screenshot')?.getAttribute('src'),
    icon:document.querySelector('.project-identity .official-project-icon')?.getAttribute('src'),
    count:document.querySelectorAll('.craft-gallery-tiles img').length+1,
    credit:document.querySelector('.craft-product-gallery figcaption')?.textContent,
    officialLauncher:!!document.querySelector('.craft-distribution-note a[href="https://github.com/storytold/craft-launcher/releases/latest"]'),
    duplicateBrand:document.querySelectorAll('img[src*="artcraft-mark"],img[src*="artcraft-logo"]').length,
    source:document.querySelector('.craft-product-gallery figcaption a')?.getAttribute('href')
   }));
   assert.ok(metrics.src?.startsWith('/media/craft/screenshots/'+id+'/'));
   assert.equal(metrics.icon,'/media/craft/icons/'+id+'.png');
   assert.ok(metrics.count>=3);
   assert.ok(metrics.credit?.includes('OFFICIAL APPLICATION SCREENSHOT'));
   assert.ok(metrics.officialLauncher,'First-party distribution link absent');
   assert.equal(metrics.duplicateBrand,0);
   assert.ok(metrics.source?.startsWith('https://github.com/storytold/'));
   if(id==='cadcraft'){
    await page.click('.craft-gallery-more summary');
    await page.waitForFunction(()=>[...document.querySelectorAll('.craft-gallery-tiles img')].every(x=>x.complete&&x.naturalWidth>500),{timeout:17000});
    await page.screenshot({path:path.join(out,'cadcraft-real-gallery-1100x740.png'),fullPage:true});
   }
   if(id==='figcraft')await page.screenshot({path:path.join(out,'figcraft-real-original-1100x740.png'),fullPage:true});
   console.log('CRAFT_APP_ORIGINAL_ASSET_PASS '+JSON.stringify({id,...metrics}));
   await page.click('#brandHome');
   await page.waitForSelector('#homeSearch');
  }
  await page.$eval('#homeSearch',e=>{e.value='AniCraft'});
  await page.$eval('#homeSearchForm',f=>f.requestSubmit());
  const noPreview=await page.$eval('#exploreRows',e=>!!e.querySelector('[data-project="AniCraft"]'));
  assert.equal(noPreview,false,'Do not promote empty unlisted Craft GitHub repository into normal app directory');
  await page.click('#researchToggle');
  await page.waitForSelector('#exploreRows [data-project="AniCraft"]',{timeout:14000});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(writes,[]);
  console.log('CRAFT_OFFICIAL_GALLERY_ACCEPTANCE_PASS '+JSON.stringify({verifiedProducts:4,iconsInManifest:13,
   screenshotsInManifest:47,hiddenUnreleasedAniCraft:true,errors:0,external:0,writes:0}));
 }finally{await browser.close()}
})().catch(e=>{console.error('CRAFT_OFFICIAL_GALLERY_ACCEPTANCE_FAIL',e.stack||e);process.exitCode=1});
