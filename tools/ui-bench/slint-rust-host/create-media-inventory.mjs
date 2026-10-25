#!/usr/bin/env node
// Source-identity-checked coverage map from a real one-shot Challenger catalog.
// Usage: node create-media-inventory.mjs --snapshot /path/to/live-sidecar.json
// Never submits telemetry, creates screenshots or authorizes installation.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const sourceRoot=resolve(here,'../../preview-build/media-source');
const [flag,filename]=process.argv.slice(2);
if(flag!=='--snapshot'||!filename)throw Error('Expected --snapshot <one-shot live sidecar JSON>');
const snap=JSON.parse(readFileSync(filename,'utf8'));
if(snap.schema!=='challenger.native.catalog.v2'||snap.items.length!==181||
   snap.counts.managed!==14||snap.counts.curated!==152||snap.counts.research!==15||
   !snap.networkScanDisabled||snap.writeActionsExposed)throw Error('Unverified real catalog snapshot');
const craft=JSON.parse(readFileSync(join(sourceRoot,'craft-suite-media.v1.json'),'utf8'));
const curated=JSON.parse(readFileSync(join(sourceRoot,'project-media.v1.json'),'utf8'));
const gallery=JSON.parse(readFileSync(join(here,'ui','APPROVED_GALLERY_INDEX.json'),'utf8'));
const rows=[], missing=[];
const byMedia=Map.groupBy?Map.groupBy(gallery.assets,a=>a.media):
  gallery.assets.reduce((m,a)=>{m.set(a.media,[...(m.get(a.media)||[]),a]);return m;},new Map());
const curatedNative=new Set(['dune3d','material-maker','compositor','kiri-moto','espocrm',
  'docuseal','meshcentral','openhands','real-video-enhancer']);
const names=new Set();
const featured=new Set(['curated:dune3d','curated:material-maker','managed:pdfcraft']);
for(const p of snap.items) {
 if(names.has(p.id))throw Error('Duplicate identity: '+p.id);
 names.add(p.id);
 let media='', icon='missing', mediaLicense='',sourceStatus='no-approved-media';
 const key=p.id.split(':').slice(1).join(':');
 if(p.kind==='managed'&&p.id==='managed:'+key&&
    p.source==='https://github.com/storytold/'+key&&craft.apps[key]) {
   media='craft-'+key;icon='embedded';
   mediaLicense=craft.apps[key].icon.license;
   sourceStatus='pinned-source';
 } else if(p.kind==='curated'&&p.id==='curated:'+key&&
   curated.projects[key]&&p.source==='https://github.com/'+curated.projects[key].repo) {
   const m=curated.projects[key];mediaLicense=m.license?.spdx||'';
   sourceStatus='pinned-source';
   if(m.icon?.status==='approved') icon=curatedNative.has(key)?'embedded':'source-approved-not-embedded';
   if(curatedNative.has(key))media=key;
 }
 const assets=byMedia.get(media)||[];
 const frames=assets.length;
 if(frames && !assets.every(s=>s.sha256&&s.license&&s.sourceUrl))throw Error('Missing verified frame metadata');
 if(frames===0||icon!=='embedded')missing.push({projectId:p.id,name:p.name,
   iconStatus:icon,missingScreenshot:frames===0,source:p.source,kind:p.kind});
 rows.push({
   projectId:p.id,name:p.name,kind:p.kind,sourceCategory:p.category,
   repository:p.source,sourceLicense:p.license||'Not reported',
   iconStatus:icon,screenshotCount:frames,
   screenshotChecksums:assets.map(s=>s.sha256),
   screenshotSources:assets.map(s=>s.sourceUrl),
   screenshotSourceLicenses:assets.map(s=>s.license),
   screenshotBytes:assets.reduce((sum,s)=>sum+s.bytes,0),
   mediaLicense:mediaLicense||'Not established',galleryMediaId:media,
   featuredOnExplore:featured.has(p.id),
   integration:frames?'Native Search thumbnail + Detail gallery':
     icon==='embedded'?'Native icon only':'Neutral fallback',
   installStatus:'Separate source-verified review required; catalog membership grants no install permission'
 });
}
const counts={
 projects:rows.length,managed:14,curated:152,research:15,
 nativeIcons:rows.filter(r=>r.iconStatus==='embedded').length,
 sourceApprovedIconsNotYetEmbedded:rows.filter(r=>r.iconStatus==='source-approved-not-embedded').length,
 screenshotProjects:rows.filter(r=>r.screenshotCount>0).length,
 screenshotFrames:rows.reduce((n,r)=>n+r.screenshotCount,0),
 missingIcons:rows.filter(r=>r.iconStatus!=='embedded').length,
 missingScreenshots:rows.filter(r=>r.screenshotCount===0).length,
 screenshotBytes:rows.reduce((n,r)=>n+r.screenshotBytes,0)
};
if(counts.nativeIcons!==22||counts.screenshotProjects!==16||counts.screenshotFrames!==50) {
 throw Error('Coverage discrepancy; media identity or manifests changed: '+JSON.stringify(counts));
}
const report={
 schema:'challenger-native-visual-inventory.v1',
 source:'read-only live Challenger Preview12 snapshot, source-locked manifests and native gallery index',
 inventoryCheckedAt:snap.inventory.checkedAt,
 note:'Not an install catalog; license/legal clearances and platform-specific installer paths remain separate',
 counts,records:rows,missingMedia:missing,
};
const out=join(here,'qa-results');mkdirSync(out,{recursive:true});
writeFileSync(join(out,'visual-media-inventory.json'),JSON.stringify(report,null,2)+'\n');
const cols=['projectId','name','kind','sourceCategory','repository','sourceLicense',
 'iconStatus','screenshotCount','screenshotBytes','mediaLicense','galleryMediaId','featuredOnExplore','integration'];
const csv=x=>'"'+String(x??'').replaceAll('"','""')+'"';
writeFileSync(join(out,'visual-media-inventory.csv'),
  [cols.map(csv).join(','),...rows.map(r=>cols.map(c=>csv(r[c])).join(','))].join('\n')+'\n');
writeFileSync(join(out,'visual-media-missing.json'),JSON.stringify({
  schema:'challenger-native-media-missing.v1',counts,items:missing},null,2)+'\n');
console.log('NATIVE_VISUAL_INVENTORY_PASS '+JSON.stringify(counts));
