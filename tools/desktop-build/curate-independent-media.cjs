'use strict';
/* Human-reviewed source paths, HEAD pinned to an audited GitHub commit.
 * Media bytes are not redistributed in the EXE: verified once now and fetched
 * on-demand from the exact pinned original source. Rights remain upstream.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=path.resolve(__dirname,'../..');
const audit=JSON.parse(fs.readFileSync(path.join(__dirname,'dist/all-project-media-audit.v1.json'),'utf8'));
const out=path.join(base,'independent-media.v1.json');
if(fs.existsSync(out))throw Error('Immutable curated asset registry already exists; review and version it');
const SCREEN={
 'infinite':['docs/brand/img/screenshots/field-pixel-editor.png','docs/brand/img/screenshots/canvas-overview.png'],
 'dune3d':['screenshot.png'],
 'material-maker':['material_maker/doc/images/screenshot.png'],
 'glaxnimate':['docs/docs/img/screenshots/main_window/main_window.png'],
 'mfek-glif':['doc/screenshot_main.png','doc/screenshot2.png'],
 'pixieditor':['Screenshot.png','assets/flatpak/screenshots/palettes.png'],
 'real-video-enhancer':['screenshots/settings.png','screenshots/models.png'],
 'oak-video-editor':['docs/imgs/screenshot.png'],
 'gyroflow':['resources/screenshot.jpg'],
 'goxel':['screenshots/screenshot-castle.png','screenshots/screenshot-procedural-city.png'],
 'mayo':['doc/screenshot_1.png','doc/screenshot_4.png'],
 'frappe-crm':['.github/screenshots/LeadPage.png','.github/screenshots/CallLog.png'],
 'filaops':['frontend/docs/screenshots/sop/dashboard-page.png'],
 'inventree':['docs/docs/assets/images/appgallery/Screenshot_1681915404.png'],
 'baserow':['docs/assets/screenshot.png','docs/assets/screenshot_dashboard.png'],
 'akaunting':['public/img/pwa/screenshot-dashboard.png','public/img/pwa/screenshot-invoice.png'],
 'hatchet':['frontend/docs/public/hatchet-screenshot-1.png'],
 'dify':['web/public/screenshots/light/TextGenerator.png','web/public/screenshots/dark/Chatbot.png'],
 'affine':['packages/frontend/core/public/imgs/screenshot1.png','packages/frontend/core/public/imgs/screenshot2.png'],
 'activepieces':['docs/resources/screenshots/using-activepieces-overview-main-screen.png',
   'docs/resources/screenshots/using-activepieces-overview-piece-settings.png'],
 'paperless':['docs/assets/screenshots/dashboard.png','docs/assets/screenshots/search-preview.png'],
 'anythingllm':['images/screenshots/upload.png','images/screenshots/create_stack.png'],
 'n8n':['assets/n8n-screenshot-readme.png'],
 'helio':['Projects/Android/app/src/main/play/listings/en-US/graphics/phone-screenshots/1.png'],
 'rustdesk':['fastlane/metadata/android/en-US/images/sevenInchScreenshots/8.png'],
 'gh-actualbudget-actual':['packages/desktop-electron/screenshots/budget-gnome-light.png'],
 'gh-chatwoot-chatwoot':['.github/screenshots/dashboard.png'],
 'gh-metabase-metabase':['docs/images/metabase-product-screenshot-updated.png'],
 'gh-lightdash-lightdash':['static/screenshots/lightdash_preview.png'],
 'gh-openobserve-openobserve':['screenshots/home.png'],
 'gh-mathesar-foundation-mathesar':['assets/readme/screenshots/08-record-page.png'],
 'gh-4ian-gdevelop':['newIDE/GDevelop screenshot.png']
};
const ICON={
 'compositor':'Compositor/Assets.xcassets/AppIcon.appiconset/app-icon-512.png',
 'composa':'src/Composa.App/Assets/icon.png',
 'infinite':'website/assets/icon.png',
 'material-maker':'icon.png',
 'godsvg':'assets/logos/icon.png',
 'mfek-glif':'resources/icon.png',
 'oak-video-editor':'assets/appicon/icon.png',
 'goxel':'osx/goxel/goxel/Assets.xcassets/AppIcon.appiconset/256.png',
 'mayo':'images/appicon_128.png',
 'frappe-crm':'crm/public/images/logo.png',
 'inventree':'docs/docs/assets/logo.png',
 'zed':'crates/zed/resources/app-icon.png',
 'affine':'packages/frontend/apps/ios/App/App/Assets.xcassets/AppIcon.appiconset/light.png',
 'helio':'Projects/iOS/Helio/Images.xcassets/AppIcon.appiconset/Icon.png',
 'gh-actualbudget-actual':'packages/desktop-electron/icons/icon.png',
 'gh-chatwoot-chatwoot':'app/javascript/design-system/images/logo.png',
 'gh-openpanel-dev-openpanel':'apps/dashboard/public/logo.png'
};
const indexed=new Map(audit.projects.map(x=>[x.id,x]));
const outputs=new Map(),failures=[];
const jobs=[];
for(const [id,paths] of Object.entries(SCREEN))for(const p of paths)jobs.push({id,p,kind:'screen'});
for(const [id,p] of Object.entries(ICON))jobs.push({id,p,kind:'icon'});
const blobSha=b=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
function decodeDimensions(buf,ext){
 if(ext==='png')return {width:buf.readUInt32BE(16),height:buf.readUInt32BE(20)};
 if(ext==='jpg'||ext==='jpeg'){
  let o=2;while(o+8<buf.length){
   if(buf[o]!==255){o++;continue}
   const marker=buf[o+1],len=buf.readUInt16BE(o+2);
   if([192,193,194,195,198,199,201,202,203,205,206,207].includes(marker))
    return {width:buf.readUInt16BE(o+7),height:buf.readUInt16BE(o+5)};
   if(len<=0)break;
   o+=len+2;
  }
 }
 return {width:null,height:null};
}
function validate(buf,ext,kind){
 if(buf.length<500||buf.length>2400000)return null;
 if(ext==='png'){
  if(!buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return null;
 }else if(ext==='jpg'){
  if(!(buf[0]===255&&buf[1]===216&&buf[2]===255))return null;
 }else if(ext==='webp'){
  if(buf.toString('ascii',0,4)!=='RIFF'||buf.toString('ascii',8,12)!=='WEBP')return null;
 }else return null;
 const dim=decodeDimensions(buf,ext);
 if(kind==='icon'&&dim.width!==null&&(dim.width<32||dim.height<32))return null;
 if(kind==='screen'&&dim.width!==null&&(dim.width<480||dim.height<230))return null;
 return dim;
}
function repoPath(j){
 const a=indexed.get(j.id);
 if(!a||!a.tree?.commit||a.errors.length)throw Error('Upstream audit unavailable '+j.id);
 const inventory=j.kind==='icon'?a.icons:a.screenshots;
 let obj=inventory.find(x=>x.path===j.p);
 if(!obj&&j.kind==='screen'){ // Some valid images ranked below first eight: verify via isolated tree lookup separately.
  throw Error('Not in audited explicit screenshot shortlist: '+j.id+'/'+j.p);
 }
 if(!obj)throw Error('Not in audited app icon candidates: '+j.id+'/'+j.p);
 if(obj.size<500||obj.size>2400000||!/^[a-f0-9]{40}$/.test(obj.sha))throw Error('Invalid Git blob metadata');
 return {a,obj};
}
async function one(j){
 try{
  const {a,obj}=repoPath(j);
  const raw='https://raw.githubusercontent.com/'+a.repository+'/'+a.tree.commit+'/'+
   j.p.split('/').map(encodeURIComponent).join('/');
  const response=await fetch(raw,{signal:AbortSignal.timeout(18000),headers:{'User-Agent':'Challenger-Hub-Curated-Media-QA'}});
  if(!response.ok||new URL(response.url).hostname!=='raw.githubusercontent.com')throw Error('source HTTP '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length!==obj.size||blobSha(bytes)!==obj.sha)throw Error('Git source blob does not match pinned tree');
  const ext=j.p.split('.').at(-1).toLowerCase().replace('jpeg','jpg');
  const dimensions=validate(bytes,ext,j.kind);
  if(!dimensions)throw Error('Disallowed image size, magic or dimensions');
  const row=outputs.get(j.id)||{repository:a.repository,commit:a.tree.commit,
   reviewStatus:a.reviewStatus,license:a.license||null,icon:null,screenshots:[]};
  const metadata={path:j.p,gitBlobSha:obj.sha,sha256:sha256(bytes),bytes:bytes.length,
   width:dimensions.width,height:dimensions.height,format:ext,
   source:'https://github.com/'+a.repository+'/blob/'+a.tree.commit+'/'+j.p.split('/').map(encodeURIComponent).join('/')};
  if(j.kind==='icon')row.icon=metadata;else row.screenshots.push(metadata);
  outputs.set(j.id,row);
  console.log('PINNED_IMAGE_VERIFIED '+JSON.stringify({id:j.id,kind:j.kind,path:j.p,bytes:bytes.length,dim:dimensions}));
 }catch(e){failures.push({id:j.id,kind:j.kind,path:j.p,error:String(e.message).slice(0,180)});
  console.log('PINNED_IMAGE_REJECTED '+JSON.stringify(failures.at(-1)))}
}
(async()=>{
 let cursor=0;
 await Promise.all(Array.from({length:4},async()=>{while(cursor<jobs.length)await one(jobs[cursor++])}));
 const entries=Object.fromEntries([...outputs].sort((a,b)=>a[0].localeCompare(b[0])));
 const stats={requested:jobs.length,accepted:Object.values(entries).reduce((n,x)=>n+x.screenshots.length+(x.icon?1:0),0),
  projects:Object.keys(entries).length,
  screenshots:Object.values(entries).reduce((n,x)=>n+x.screenshots.length,0),
  icons:Object.values(entries).filter(x=>x.icon).length,
  failed:failures.length};
 const m={schema:'challenger-independent-media.v1',reviewedAt:'2026-10-23',
  policy:'Explicit vetted upstream repo paths, pinned commit+Git blob+SHA256. Image bytes never bundled or redistributed. On-demand verified source fetch only. Source provenance attached. No unreviewed research project is installable.',
  stats,apps:entries,rejected:failures};
 fs.writeFileSync(out,JSON.stringify(m,null,2)+'\n');
 console.log('CURATED_DEEP_REPOSITORY_IMAGES '+JSON.stringify({...stats,output:out,rejections:failures}));
 if(stats.projects<24||stats.screenshots<27||stats.icons<10)process.exitCode=2;
})().catch(e=>{console.error('CURATION_FATAL',e.stack||e);process.exitCode=1});
