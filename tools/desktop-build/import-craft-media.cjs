'use strict';
/* Intentional one-time source-audited import. Binary assets are immutable once reviewed.
 * Do not import ArtCraft's trademark wordmark, launcher A icon, or brand resources. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),dist=path.join(__dirname,'dist');
const launch=path.join(dist,'artcraft-launcher-source-audit'),images=path.join(dist,'artcraft-media-audit');
const mediaRoot=path.join(root,'tools/preview-build/media-source'),assetRoot=path.join(mediaRoot,'assets');
const outManifest=path.join(mediaRoot,'craft-suite-media.v1.json');
const APP_IDS=['photocraft','lightcraft','filmcraft','designcraft','vectorcraft','pdfcraft','effectcraft','wordcraft','deckcraft','gridcraft','cadcraft','soundcraft','figcraft'];
const LAUNCHER_COMMIT='9419d89',SCREENSHOT_TAG='v1',SCREENSHOT_COMMIT='41f2960';
const PDF_COMMIT='0dc77fe4ed8810b9e9f25b9dd050afae662c062a';
const FIG_COMMIT='80f916326fb94f3a88cb24e64f396f564a0ebc06';
const extra={
 pdfcraft:[['viewer','pdfcraft-viewer.png'],['dark','pdfcraft-dark.png'],['forms','pdfcraft-forms.png'],['organize','pdfcraft-organize.png']],
 figcraft:[['hero','shot-1-hero.png'],['components','shot-2-components.png'],['prototype','shot-3-prototype.png'],['devmode','shot-4-devmode.png']]
};
const bytesSha=b=>crypto.createHash('sha256').update(b).digest('hex');
function git(cwd,...args){return require('node:child_process').execFileSync('git',args,{cwd,encoding:'utf8',windowsHide:true}).trim();}
function assertPNG(b){return b.length>300&&b.length<4e6&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))}
function assertJPEG(b){return b.length>6000&&b.length<2e6&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff}
function put(dest,buf){
 if(fs.existsSync(dest))throw Error('Media import immutable file already exists: '+dest);
 fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,buf);
}
async function fetchPinned(url){
 const u=new URL(url);
 if(u.protocol!=='https:'||u.host!=='raw.githubusercontent.com'||u.pathname.includes('..'))throw Error('Untrusted image URL');
 const response=await fetch(url,{headers:{'User-Agent':'Challenger-Suite-Media-Audit'},signal:AbortSignal.timeout(20000)});
 if(!response.ok||new URL(response.url).hostname!=='raw.githubusercontent.com')throw Error('Pinned source fetch failed: '+response.status);
 const len=Number(response.headers.get('content-length')||0);if(len>2e6)throw Error('Oversize PNG');
 const content=Buffer.from(await response.arrayBuffer());if(content.length>2e6||!assertPNG(content))throw Error('Expected verified PNG');
 return content;
}
async function main(){
 assert.equal(git(launch,'rev-parse','--short','HEAD'),LAUNCHER_COMMIT);
 assert.equal(git(images,'rev-parse','--short','HEAD'),SCREENSHOT_COMMIT);
 if(fs.existsSync(outManifest))throw Error('Refusing to overwrite existing curated Craft media manifest');
 const appAssets={};let totalShots=0,totalBytes=0;
 for(const id of APP_IDS){
  const iconSource=path.join(launch,'assets/app-icons',id+'.png');
  const iconBytes=fs.readFileSync(iconSource);if(!assertPNG(iconBytes))throw Error('Invalid official icon '+id);
  const iconRel='media/craft/icons/'+id+'.png',iconDst=path.join(assetRoot,iconRel);
  put(iconDst,iconBytes);totalBytes+=iconBytes.length;
  const icon={path:'/'+iconRel,source:'https://github.com/storytold/craft-launcher/blob/'+LAUNCHER_COMMIT+'/assets/app-icons/'+id+'.png',
   upstreamOriginal:'https://github.com/storytold/'+id+'/blob/main/assets/app-icon/hicolor/128x128/apps/ai.storyteller.'+id+'.png',
   sha256:bytesSha(iconBytes),size:iconBytes.length,type:'official-product-app-icon',license:'MIT OR Apache-2.0'};
  let shotList=[];
  if(extra[id]){
   for(const [name,file] of extra[id]){
    const commit=id==='figcraft'?FIG_COMMIT:PDF_COMMIT;
    const source='https://raw.githubusercontent.com/storytold/'+id+'/'+commit+'/docs/images/'+file;
    const b=await fetchPinned(source);
    const rel='media/craft/screenshots/'+id+'/'+name+'.png';
    put(path.join(assetRoot,rel),b);totalBytes+=b.length;
    shotList.push({key:name,path:'/'+rel,source:'https://github.com/storytold/'+id+'/blob/'+commit+'/docs/images/'+file,
      sha256:bytesSha(b),size:b.length,format:'png',license:'Apache-2.0',caption:id+' · '+name.replaceAll('-',' ')});
   }
  }else{
   const folder=path.join(images,id);const names=fs.readdirSync(folder).filter(x=>/^[a-z0-9-]+\.jpg$/i.test(x)).sort();
   if(!names.length||names.length>8)throw Error('Unexpected screenshot folder '+id);
   for(const file of names){
    const b=fs.readFileSync(path.join(folder,file));if(!assertJPEG(b))throw Error('Invalid screenshot '+id+'/'+file);
    const rel='media/craft/screenshots/'+id+'/'+file;
    put(path.join(assetRoot,rel),b);totalBytes+=b.length;
    shotList.push({key:file.slice(0,-4),path:'/'+rel,
      source:'https://github.com/storytold/craft-launcher-assets/blob/'+SCREENSHOT_TAG+'/'+id+'/'+file,
      sha256:bytesSha(b),size:b.length,format:'jpg',license:'MIT OR Apache-2.0',
      caption:id+' · '+file.slice(0,-4).replaceAll('-',' ')});
   }
  }
  if(!shotList.length)throw Error('Official app missing all screenshots '+id);
  totalShots+=shotList.length;
  appAssets[id]={icon,screenshots:shotList};
 }
 if(APP_IDS.length!==13||totalShots!==47)throw Error('Unexpected source media count '+totalShots);
 const data={schema:'challenger-craft-media.v1',reviewedOn:'2026-10-23',
  provenance:{icons:'storytold/craft-launcher@'+LAUNCHER_COMMIT,majorityScreenshots:'storytold/craft-launcher-assets@v1 ('+SCREENSHOT_COMMIT+')',
    pdfcraft:'storytold/pdfcraft@'+PDF_COMMIT,figcraft:'storytold/figcraft@'+FIG_COMMIT},
  note:'App icons and source screenshots ONLY; no ArtCraft name, wordmark or A mark. Credit in CRAFT_SUITE_MEDIA_NOTICES.md.',
  apps:appAssets};
 fs.writeFileSync(outManifest,JSON.stringify(data,null,2)+'\n');
 const lines=['# Source and license notices: Craft App Suite media','','These unmodified assets represent the **individual Craft Apps**, not the ArtCraft company or launcher identity. They do NOT include the ArtCraft wordmark, the ArtCraft A trademark or launcher brand imagery.','',
 '13 product icons originated from the individual Craft Apps and are redistributed under the app-specific MIT OR Apache-2.0 licenses, as indexed in [ArtCraft Launcher attribution](https://github.com/storytold/craft-launcher/blob/'+LAUNCHER_COMMIT+'/ATTRIBUTION.md).',
 '39 screenshot JPGs are pinned to [craft-launcher-assets v1](https://github.com/storytold/craft-launcher-assets/blob/v1/ATTRIBUTION.md); the authors, their source images and artwork licenses are recorded individually in that attribution.',
 '4 extra screenshots are from [PdfCraft](https://github.com/storytold/pdfcraft/tree/'+PDF_COMMIT+'/docs/images), and 4 from [FigCraft](https://github.com/storytold/figcraft/tree/'+FIG_COMMIT+'/docs/images), under Apache-2.0 for their code and UI.','','User-visible images are authentic project interface screenshots, not illustrative mockups. They are displayed with links to their exact pinned source files.',''];
 for(const [id,a] of Object.entries(appAssets)){
  lines.push('## '+id);
  lines.push('- [Original product icon]('+a.icon.upstreamOriginal+') (MIT OR Apache-2.0)');
  for(const im of a.screenshots)lines.push('- [Screenshot '+im.key+']('+im.source+') ('+im.license+')');
 }
 fs.writeFileSync(path.join(mediaRoot,'CRAFT_SUITE_MEDIA_NOTICES.md'),lines.join('\n')+'\n');
 console.log('APP_MEDIA_IMPORTED '+JSON.stringify({apps:APP_IDS.length,icons:APP_IDS.length,screenshots:totalShots,totalBytes,manifest:outManifest}));
}
main().catch(e=>{console.error('IMPORT_REJECTED',e.stack||e);process.exitCode=1});
