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
const independent=JSON.parse(readFileSync(resolve(here,'../../../independent-media.v1.json'),'utf8'));
const selected=JSON.parse(readFileSync(join(here,'independent-native-selection.v1.json'),'utf8'));
if(independent.schema!=='challenger-independent-media.v1' ||
  selected.schema!=='challenger-native-independent-gallery-selection.v1') {
  throw Error('Independent visual audit missing');
}
const auditedById=new Map(selected.selected.map(x=>['curated:'+x.key,x]));
const gallery=JSON.parse(readFileSync(join(here,'ui','APPROVED_GALLERY_INDEX.json'),'utf8'));
const credits=JSON.parse(readFileSync(join(here,'ui','MEDIA_CREDITS.json'),'utf8'));
if(credits.schema!=='challenger-native-media-attribution.v1' || credits.totals.sourceVerifiedAssets!==100)throw Error('Missing image rights ledger');
const rows=[], missing=[];
const byMedia=Map.groupBy?Map.groupBy(gallery.assets,a=>a.media):
  gallery.assets.reduce((m,a)=>{m.set(a.media,[...(m.get(a.media)||[]),a]);return m;},new Map());
const icons=new Map((gallery.icons||[]).map(x=>[x.media,x]));
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
 } else if(p.kind==='curated'&&auditedById.has(p.id)) {
   const audit=auditedById.get(p.id),m=independent.apps[audit.key];
   if(m?.reviewStatus!=='repository-confirmed' ||
      m.repository!==audit.repository || m.commit!==audit.commit ||
      m.license!==audit.sourceReportedRepositoryLicense ||
      p.source!=='https://github.com/'+m.repository) {
     throw Error('Source identity mismatch in independently reviewed catalog: '+p.id);
   }
   media='independent-'+audit.key;
   mediaLicense=m.license;
   sourceStatus='independently-reviewed-pinned-source';
   if(audit.icon) {
     if(!icons.get(media) || icons.get(media).sha256!==m.icon.sha256) {
       throw Error('Independent native icon not pinned: '+p.id);
     }
     icon='embedded';
   }
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
   presentationMode:frames>0?'official':'identity',
   screenshotChecksums:assets.map(s=>s.sha256),
   screenshotSources:assets.map(s=>s.sourceUrl),
   screenshotSourceLicenses:assets.map(s=>s.license),
   screenshotBytes:assets.reduce((sum,s)=>sum+s.bytes,0),
   mediaLicense:mediaLicense||'Not established',galleryMediaId:media,
   mediaSourceReview:sourceStatus,
   mediaSpecificRightsVerified:false,
   mediaRightsStatus:(frames||icon==='embedded')?'Source verified; reproduction/trademark permission not independently confirmed':'No embedded media to clear',
   embeddedIconSource:icons.get(media)?.sourceUrl||'',
   embeddedIconSha256:icons.get(media)?.sha256||'',
   featuredOnExplore:featured.has(p.id),
   integration:frames?'Original screenshot in Results and source-locked Detail gallery':
     'Typography-only project identity in Results and Detail (official icon if approved)',
   installStatus:'Separate source-verified review required; catalog membership grants no install permission'
 });
}
const counts={
 projects:rows.length,managed:14,curated:152,research:15,
 nativeIcons:rows.filter(r=>r.iconStatus==='embedded').length,
 sourceApprovedIconsNotYetEmbedded:rows.filter(r=>r.iconStatus==='source-approved-not-embedded').length,
 screenshotProjects:rows.filter(r=>r.screenshotCount>0).length,
 officialPreviewProjects:rows.filter(r=>r.presentationMode==='official').length,
 identityCardProjects:rows.filter(r=>r.presentationMode==='identity').length,
 screenshotFrames:rows.reduce((n,r)=>n+r.screenshotCount,0),
 missingIcons:rows.filter(r=>r.iconStatus!=='embedded').length,
 missingScreenshots:rows.filter(r=>r.screenshotCount===0).length,
 screenshotBytes:rows.reduce((n,r)=>n+r.screenshotBytes,0)
};
if(counts.nativeIcons!==30||counts.screenshotProjects!==29||counts.screenshotFrames!==70 ||
   gallery.totalIcons!==30 || gallery.independentSelectedProjects!==14 ||
   counts.officialPreviewProjects!==29 || counts.identityCardProjects!==152 ||
   counts.officialPreviewProjects+counts.identityCardProjects!==181) {
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
 'iconStatus','embeddedIconSource','embeddedIconSha256','screenshotCount','screenshotBytes','presentationMode',
 'mediaLicense','mediaSourceReview','mediaRightsStatus','mediaSpecificRightsVerified','galleryMediaId','featuredOnExplore','integration'];
const csv=x=>'"'+String(x??'').replaceAll('"','""')+'"';
writeFileSync(join(out,'visual-media-inventory.csv'),
  [cols.map(csv).join(','),...rows.map(r=>cols.map(c=>csv(r[c])).join(','))].join('\n')+'\n');
writeFileSync(join(out,'visual-media-missing.json'),JSON.stringify({
  schema:'challenger-native-media-missing.v1',counts,items:missing},null,2)+'\n');
// Category-by-category backlog, derived only from verified live catalog rows.
const byCategory=new Map();
for(const r of rows) {
 const key=r.sourceCategory||'Uncategorized';
 if(!byCategory.has(key))byCategory.set(key,{sourceCategory:key,totalProjects:0,
   projectsWithScreenshots:0,projectsWithIcons:0,missingScreenshots:0,missingIcons:0});
 const x=byCategory.get(key);
 x.totalProjects++;
 if(r.screenshotCount)x.projectsWithScreenshots++;else x.missingScreenshots++;
 if(r.iconStatus==='embedded')x.projectsWithIcons++;else x.missingIcons++;
}
const categories=[...byCategory.values()].sort((a,b)=>b.missingScreenshots-a.missingScreenshots||
  b.totalProjects-a.totalProjects||a.sourceCategory.localeCompare(b.sourceCategory));
writeFileSync(join(out,'visual-media-category-coverage.json'),JSON.stringify({
  schema:'challenger-native-visual-category-coverage.v1',categories},null,2)+'\n');
const catColumns=['sourceCategory','totalProjects','projectsWithScreenshots',
 'projectsWithIcons','missingScreenshots','missingIcons'];
writeFileSync(join(out,'visual-media-category-coverage.csv'),
  [catColumns.map(csv).join(','),...categories.map(x=>catColumns.map(k=>csv(x[k])).join(','))].join('\n')+'\n');
console.log('NATIVE_VISUAL_INVENTORY_PASS '+JSON.stringify(counts));
