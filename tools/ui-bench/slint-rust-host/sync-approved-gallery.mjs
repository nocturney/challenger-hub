#!/usr/bin/env node
// Deterministic offline sync. Unmodified upstream screenshot bytes only.
// --check refuses any missing/stale/altered asset or generated map.
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const sources=resolve(here,'../../preview-build/media-source');
const craft=JSON.parse(readFileSync(join(sources,'craft-suite-media.v1.json'),'utf8'));
const curated=JSON.parse(readFileSync(join(sources,'project-media.v1.json'),'utf8'));
const independent=JSON.parse(readFileSync(resolve(here,'../../../independent-media.v1.json'),'utf8'));
const selection=JSON.parse(readFileSync(join(here,'independent-native-selection.v1.json'),'utf8'));
const check=process.argv.includes('--check');
const sha=(b)=>createHash('sha256').update(b).digest('hex');
function pixelSize(b) {
  if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
  }
  if(b[0]===255 && b[1]===216) {
    let i=2;
    while(i+10<b.length) {
      if(b[i++]!==255) continue;
      const marker=b[i++];
      if(marker===0xd9||marker===0xda)break;
      if(marker===0x01||(marker>=0xd0&&marker<=0xd8))continue;
      const len=b.readUInt16BE(i);
      if(len<2||i+len>b.length)throw Error('Invalid JPEG segment');
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        return {width:b.readUInt16BE(i+5),height:b.readUInt16BE(i+3)};
      }
      i+=len;
    }
  }
  throw Error('Unsupported/invalid approved UI image format');
}
const files=[];
const shots=[];
const icons=[];
function addShot(media,index,sourcePath,manifest,uiPath,sourceUrl,caption) {
  if (!manifest.sha256 || !manifest.size || !manifest.license && !manifest.licenseSpdx) {
    throw Error('Unapproved screenshot metadata: '+media+'/'+index);
  }
  if(!/^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\//.test(sourceUrl)) {
    throw Error('Screenshot source is not a versioned GitHub reference: '+sourceUrl);
  }
  const original=readFileSync(sourcePath);
  if(original.length!==manifest.size || sha(original)!==manifest.sha256) {
    throw Error('Source screenshot checksum/size mismatch: '+media+'/'+index);
  }
  const output=join(here,'ui',uiPath);
  if(check) {
    if(!existsSync(output) || sha(readFileSync(output))!==manifest.sha256) {
      throw Error('Embedded native asset missing/altered: '+uiPath);
    }
  } else {
    mkdirSync(dirname(output),{recursive:true});
    if(sourcePath!==output)copyFileSync(sourcePath,output);
  }
  files.push(uiPath);
  shots.push({media,index,uiPath,sourceUrl,caption,sha256:manifest.sha256,
    license:manifest.license||manifest.licenseSpdx,bytes:manifest.size,...pixelSize(original)});
}
if(craft.schema!=='challenger-craft-media.v1' || curated.schema!=='challenger-project-media.v1') {
  throw Error('Unexpected upstream media manifest schema');
}
for(const key of ['dune3d','material-maker','real-video-enhancer']) {
  const m=curated.projects[key].screenshot;
  if(m.status!=='approved' || m.type!=='application-ui-screenshot' || !m.sourceCommit ||
     m.sourceRepository!==curated.projects[key].repo) {
    throw Error('Untrusted curated screenshot identity: '+key);
  }
  // Keep the original pinned file and its approved in-tree native name.
  const filename=key+'.png';
  const origin=join(sources,'assets','screenshots',filename);
  const knownNative=join(here,'ui',filename);
  if(sha(readFileSync(origin))!==m.sha256 || sha(readFileSync(knownNative))!==m.sha256) {
    throw Error('Curated screenshot changed: '+key);
  }
  const prefix='https://raw.githubusercontent.com/'+m.sourceRepository+'/'+m.sourceCommit+'/';
  if(!m.source.startsWith(prefix))throw Error('Curated source path mismatch: '+key);
  const sourceUrl='https://github.com/'+m.sourceRepository+'/blob/'+m.sourceCommit+'/'+m.source.slice(prefix.length);
  shots.push({media:key,index:0,uiPath:filename,sourceUrl,caption:m.caption,
    sha256:m.sha256,license:m.licenseSpdx,bytes:m.size,...pixelSize(readFileSync(origin))});
}
for(const [key,app] of Object.entries(craft.apps)) {
  if(!Array.isArray(app.screenshots) || app.screenshots.length===0)throw Error('Missing Craft screenshots '+key);
  for(let i=0;i<app.screenshots.length;i++) {
    const s=app.screenshots[i];
    const keyOk=/^[a-z0-9-]+$/.test(key) && /^[a-z0-9-]+$/.test(s.key);
    const ext=s.format==='jpg'?'jpg':s.format==='png'?'png':null;
    if(!keyOk||!ext||!s.path.endsWith('/'+key+'/'+s.key+'.'+ext)) {
      throw Error('Manifest asset path not canonical: '+key+'/'+s.key);
    }
    const original=join(sources,'assets',s.path.replace(/^\//,''));
    const native='screenshots/'+key+'/'+s.key+'.'+ext;
    const label=(s.caption||key+' · '+s.key).replace(/\s+/g,' ').trim();
    addShot('craft-'+key,i,original,s,native,s.source,label);
  }
}
// Independent second wave: exact project identity, reviewed repository status,
// pinned git source, source-reported repository license and original image bytes.
// Images remain local/embedded and are never fetched by the GUI or CI.
if(independent.schema!=='challenger-independent-media.v1' ||
   selection.schema!=='challenger-native-independent-gallery-selection.v1' ||
   !Array.isArray(selection.selected) || selection.selected.length!==14 ||
   new Set(selection.selected.map(x=>x.key)).size!==14) {
  throw Error('Unexpected independently reviewed native gallery selection');
}
const approvedRepoLicenses=new Set(['MIT','Apache-2.0','GPL-3.0','AGPL-3.0','LGPL-3.0','BSD-2-Clause']);
function checkedIndependent(key,app,kind,index,x) {
  if(!x || !['png','jpg'].includes(x.format) ||
     !/^[0-9a-f]{64}$/.test(x.sha256) ||
     !/^[0-9a-f]{40}$/.test(x.gitBlobSha) ||
     !Number.isSafeInteger(x.bytes) || x.bytes<500 || x.bytes>2400000 ||
     !/^[A-Za-z0-9 _@+./-]{1,230}\.(png|jpg)$/.test(x.path||'') ||
     x.path.startsWith('/') || x.path.includes('..') || x.path.includes('\\')) {
    throw Error('Unsafe independent media manifest: '+key+'/'+kind+'/'+index);
  }
  const expectedSource='https://github.com/'+app.repository+'/blob/'+app.commit+'/' +
      x.path.split('/').map(encodeURIComponent).join('/');
  if(x.source!==expectedSource)throw Error('Unpinned original media link: '+key+'/'+kind);
  const local=''+(kind==='icon'?'icons/independent/'+key+'.'+x.format:
      'screenshots/independent/'+key+'/'+index+'.'+x.format);
  const full=join(here,'ui',local);
  if(!existsSync(full))throw Error('Original independent image not embedded: '+local);
  const data=readFileSync(full);
  if(data.length!==x.bytes || sha(data)!==x.sha256) {
    throw Error('Original independent image digest differs: '+local);
  }
  const pixels=pixelSize(data);
  if(pixels.width!==x.width || pixels.height!==x.height ||
     (kind==='screenshot' && (pixels.width<480 || pixels.height<230))) {
    throw Error('Untrusted original image dimensions: '+local);
  }
  if(kind==='icon') {
    icons.push({media:'independent-'+key,projectId:'curated:'+key,uiPath:local,
      sourceUrl:x.source,sha256:x.sha256,license:app.license,bytes:x.bytes,...pixels});
    files.push(local);
  } else {
    const caption=key+' · '+x.path.split('/').pop().replace(/\.[^.]+$/,'').replace(/[_-]/g,' ');
    addShot('independent-'+key,index,full,{sha256:x.sha256,size:x.bytes,
      license:app.license},local,x.source,caption);
  }
}
for(const approved of selection.selected) {
  const key=approved.key, app=independent.apps[key];
  if(!/^[a-z][a-z0-9-]{1,79}$/.test(key) ||
     !app || app.reviewStatus!=='repository-confirmed' ||
     app.repository!==approved.repository || app.commit!==approved.commit ||
     app.license!==approved.sourceReportedRepositoryLicense ||
     !approvedRepoLicenses.has(app.license) ||
     !/^[0-9a-f]{40}$/.test(app.commit) ||
     !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(app.repository) ||
     app.screenshots.length!==approved.screenshotCount ||
     Boolean(app.icon)!==approved.icon ||
     (app.screenshots.length===0 && !app.icon)) {
    throw Error('Unapproved source identity/rights/status: '+key);
  }
  for(let i=0;i<app.screenshots.length;i++) {
    checkedIndependent(key,app,'screenshot',i,app.screenshots[i]);
  }
  if(app.icon)checkedIndependent(key,app,'icon',0,app.icon);
}
if(shots.length!==70 || files.length!==75 || icons.length!==8) {
  throw Error('Expected 3 curated + 47 Craft + 20 independent screenshots and eight icons');
}
// Credits are provenance, NOT a copyright or trademark permission certificate.
// Explicitly keep clearance unresolved until actual media rights are reviewed.
function sourceRepository(url) {
  const u=new URL(url);
  if(u.protocol!=='https:' ||
     !['github.com','raw.githubusercontent.com'].includes(u.hostname) ||
     u.username || u.password || u.port)throw Error('Untrusted media source URL: '+url);
  const segments=u.pathname.split('/').filter(Boolean);
  if(segments.length<4 || (u.hostname==='github.com' && segments[2]!=='blob')) {
    throw Error('Source URL lacks an original repo + revision/path: '+url);
  }
  return segments[0]+'/'+segments[1];
}
const embeddedCuratedIconIds=new Set(['dune3d','material-maker','compositor','kiri-moto',
  'espocrm','docuseal','meshcentral','openhands','real-video-enhancer']);
const iconCredits=[];
for(const [key,m] of Object.entries(curated.projects)) {
  if(!embeddedCuratedIconIds.has(key))continue;
  const icon=m.icon;
  if(!icon || icon.status!=='approved')throw Error('Embedded curated icon provenance missing '+key);
  if(m.repo!==icon.repository || !/^[0-9a-f]{64}$/.test(icon.sha256) ||
     !icon.licenseSpdx || !icon.source)throw Error('Untrusted curated icon credit '+key);
  const sourceRepo=sourceRepository(icon.source);
  if(sourceRepo!==m.repo)throw Error('Curated icon source mismatch '+key);
  iconCredits.push({media:key,projectId:'curated:'+key,assetKind:'icon',
    sourceRepository:sourceRepo,sourceUrl:icon.source,
    repositoryReportedLicense:icon.licenseSpdx,sha256:icon.sha256,
    mediaSpecificPermission:'unverified',trademarkPermission:'unverified'});
}
for(const [key,app] of Object.entries(craft.apps)) {
  const icon=app.icon;
  if(!icon?.source || !icon?.license || !/^[0-9a-f]{64}$/.test(icon.sha256)) {
    throw Error('Missing Craft image credits: '+key);
  }
  iconCredits.push({media:'craft-'+key,projectId:'managed:'+key,assetKind:'icon',
    sourceRepository:sourceRepository(icon.source),sourceUrl:icon.source,
    repositoryReportedLicense:icon.license,sha256:icon.sha256,
    mediaSpecificPermission:'unverified',trademarkPermission:'unverified'});
}
for(const icon of icons) {
  iconCredits.push({media:icon.media,projectId:icon.projectId,assetKind:'icon',
    sourceRepository:sourceRepository(icon.sourceUrl),sourceUrl:icon.sourceUrl,
    repositoryReportedLicense:icon.license,sha256:icon.sha256,
    mediaSpecificPermission:'unverified',trademarkPermission:'unverified'});
}
const screenshotCredits=shots.map(s=>({
  media:s.media,index:s.index,assetKind:'screenshot',
  sourceRepository:sourceRepository(s.sourceUrl),sourceUrl:s.sourceUrl,
  repositoryReportedLicense:s.license,sha256:s.sha256,
  mediaSpecificPermission:'unverified',trademarkPermission:'not-evaluated',
}));
if(iconCredits.length!==30 || screenshotCredits.length!==70 ||
   new Set(iconCredits.map(i=>i.media)).size!==30) {
  throw Error('Media credit coverage must equal 30 icon identities and 70 frames');
}
const allCredits=[...screenshotCredits,...iconCredits];
for(const i of allCredits) {
  if(!i.sourceRepository || !i.sourceUrl || !i.repositoryReportedLicense ||
      i.mediaSpecificPermission!=='unverified' || !/^[0-9a-f]{64}$/.test(i.sha256)) {
    throw Error('Media attribution is incomplete or misleading: '+i.media);
  }
}
const creditsDocument={
  schema:'challenger-native-media-attribution.v1',
  policy:'Credit is source attribution, not permission to copy, redistribute or use a trademark.',
  copyrightClearance:'not-independently-verified',
  thirdPartyMediaPublicReleaseApproved:false,
  entries:allCredits,
  totals:{screenshots:screenshotCredits.length,icons:iconCredits.length,
    sourceVerifiedAssets:allCredits.length,
    mediaSpecificPermissionConfirmed:allCredits.filter(x=>x.mediaSpecificPermission==='confirmed').length},
};
const creditLines=[
 '# Challenger Native Preview — Image and icon credits',
 '',
 'Developer preview. Credits identify the original source, but **attribution alone',
 'is not a copyright permission or trademark license**. The repository-reported',
 'license below might cover source code without independently licensing all',
 'images, artwork, third-party content or logos. Public redistributors must',
 'review each medium and applicable notices or obtain specific permission.',
 'No project is represented as endorsing Challenger Hub.',
 '',
 'Gallery source links always point to the original GitHub asset; embedded',
 'screenshots and icons are byte-exact, and checked against the SHA-256 below.',
 '',
];
for(const entry of allCredits) {
  creditLines.push('- '+entry.assetKind+' | '+entry.media+
    (Number.isSafeInteger(entry.index)?' / frame '+(entry.index+1):'')+
    ' | source: '+entry.sourceRepository+
    ' | repository-reported license: '+entry.repositoryReportedLicense+
    ' | media/trademark permission: NOT VERIFIED'+
    ' | SHA-256: '+entry.sha256+
    ' | original: '+entry.sourceUrl);
}
const firsts=shots.filter(s=>s.index===0);
const q=s=>JSON.stringify(s);
const lines=[
  '// AUTO-GENERATED by sync-approved-gallery.mjs; no invented imagery.',
  '// Every @image-url path is bound to the pinned/checksummed media manifests.',
  'import { TextScale } from "text-scale.slint";',
  'export component ApprovedGalleryThumb inherits Rectangle {',
  '  in property <string> media;',
  '  background: transparent;',
];
for(const s of firsts) {
  lines.push('  if root.media == '+q(s.media)+': Image { source: @image-url('+q(s.uiPath)+'); width: parent.width; height: parent.height; image-fit: cover; }');
}
lines.push('}', '', 'export component ApprovedGalleryShot inherits Rectangle {',
  '  in property <string> media;',
  '  in property <int> index;',
  '  in property <color> caption-color;',
  '  background: transparent;',
);
for(const s of shots) {
  lines.push('  if root.media == '+q(s.media)+' && root.index == '+s.index+': VerticalLayout {',
    '    spacing: 7px;',
    '    Image { source: @image-url('+q(s.uiPath)+'); image-fit: contain; vertical-stretch: 1; }',
    '    Text { text: '+q(s.caption)+'; color: root.caption-color; font-size: 11px * TextScale.factor; height: 20px * TextScale.factor; overflow: elide; }',
    '    Text { text: '+q('Source: '+sourceRepository(s.sourceUrl)+'  ·  Repository license reported: '+s.license)+'; color: root.caption-color; font-size: 10px * TextScale.factor; height: 18px * TextScale.factor; overflow: elide; }',
    '    Text { text: "Credit is not a separate image rights grant. No endorsement claimed."; color: root.caption-color; font-size: 10px * TextScale.factor; height: 19px * TextScale.factor; overflow: elide; }',
    '  }');
}
lines.push('}', '', 'export component ApprovedGalleryIcon inherits Rectangle {',
  '  in property <string> media;',
  '  background: transparent;');
for(const icon of icons) {
  lines.push('  if root.media == '+q(icon.media)+': Image { source: @image-url('+q(icon.uiPath)+'); width: parent.width; height: parent.height; image-fit: contain; }');
}
lines.push('}', '', 'export component ApprovedIconCredit inherits Rectangle {',
  '  in property <string> media;',
  '  in property <color> caption-color;',
  '  background: transparent;');
for(const icon of iconCredits) {
  lines.push('  if root.media == '+q(icon.media)+': Text { text: '+
    q('Icon: '+icon.sourceRepository+' · repo license reported: '+
      icon.repositoryReportedLicense+' · logo rights separate')+
    '; color: root.caption-color; font-size: 10px * TextScale.factor; overflow: elide; }');
}
lines.push('}', '');
const grouped=Object.groupBy?Object.groupBy(shots,s=>s.media):
  shots.reduce((o,s)=>{(o[s.media]??=[]).push(s);return o;},{});
const rs=[
  '// AUTO-GENERATED from checksum-verified source manifests; edit generator, not this file.',
  'pub fn count(media: &str) -> i32 {',
  '    match media {',
];
for(const [key,entries] of Object.entries(grouped)) {
  rs.push('        '+q(key)+' => '+entries.length+',');
}
rs.push('        _ => 0,', '    }', '}', '',
  'pub fn source(media: &str, index: i32) -> Option<&\'static str> {',
  '    match (media, index) {');
for(const s of shots)rs.push('        ('+q(s.media)+', '+s.index+') => Some('+q(s.sourceUrl)+'),');
rs.push('        _ => None,', '    }', '}', '',
  'pub fn independent_media(id: &str, source: &str) -> Option<&\'static str> {',
  '    match (id,source) {');
for(const item of selection.selected) {
  rs.push('        ('+q('curated:'+item.key)+', '+q('https://github.com/'+item.repository)+') => Some('+q('independent-'+item.key)+'),');
}
rs.push('        _ => None,', '    }', '}', '',
  'pub fn has_independent_icon(media: &str) -> bool {',
  '    matches!(media, '+icons.map(i=>q(i.media)).join(' | ')+')',
  '}', '',
  'pub fn has_icon(media: &str) -> bool {');
const embeddedBefore=[...embeddedCuratedIconIds,
  ...Object.keys(craft.apps).map(x=>'craft-'+x)];
rs.push('    matches!(media, '+[...embeddedBefore,...icons.map(i=>i.media)].map(q).join(' | ')+')',
  '}', '',
  '#[cfg(test)]',
  'mod tests {',
  '    use super::*;',
  '    #[test]',
  '    fn pinned_gallery_has_exact_70_source_verified_frames_and_safe_sources() {',
  '        let all: Vec<(&str,i32)> = vec![');
for(const [key,entries] of Object.entries(grouped))rs.push('            ('+q(key)+', '+entries.length+'),');
rs.push('        ];',
  '        assert_eq!(all.iter().map(|(_,n)| n).sum::<i32>(), 70);',
  '        for (media,n) in all {',
  '            assert_eq!(count(media),n);',
  '            for index in 0..n {',
  '                assert!(source(media,index).unwrap().starts_with("https://github.com/"));',
  '            }',
  '            assert_eq!(source(media,n),None);',
  '        }',
  '        assert_eq!(count("research:unverified"),0);',
  '        assert_eq!(source("craft-pdfcraft",99),None);',
  '        assert_eq!(independent_media("curated:rustdesk","https://github.com/rustdesk/rustdesk"),Some("independent-rustdesk"));',
  '        assert_eq!(independent_media("research:rustdesk","https://github.com/rustdesk/rustdesk"),None);',
  '        assert_eq!(independent_media("curated:rustdesk","https://github.com/attacker/rustdesk"),None);',
  '        assert!(!has_icon("independent-rustdesk"));',
  '        assert!(has_icon("independent-godsvg"));',
  '        assert!(!has_icon("independent-unknown"));',
  '    }',
  '}', '');
const notice=[
  '# Native independent project media: pinned source/rights record',
  '',
  'Developer preview. All original UI images and icons below are copied unmodified',
  'from exact upstream repository commits, digest checked, and shown only for matching',
  'reviewed catalog IDs and repository URLs. No project/brand endorsement or',
  'installation permission is asserted. License labels are **repository-reported**:',
  'they are NOT separate guarantees of rights in screenshots, trademarks or artwork.',
  'Distribution beyond developer preview requires a separate license/attribution review.',
  '',
];
for(const item of selection.selected) {
  const all=[...shots.filter(x=>x.media==='independent-'+item.key),
    ...icons.filter(x=>x.media==='independent-'+item.key)];
  notice.push('## '+item.key,
    '- Repository: https://github.com/'+item.repository,
    '- Source commit: '+item.commit,
    '- Source-reported repository license: '+item.sourceReportedRepositoryLicense,
    '- Images: '+all.length+' pinned original file(s)');
  for(const image of all) {
    notice.push('- '+(image.index===undefined?'Icon':'Screenshot '+(image.index+1))+
      ': '+image.sourceUrl+' (SHA-256 '+image.sha256+')');
  }
  notice.push('');
}
if(notice.at(-1)==='')notice.pop();
const outputs=[
  [join(here,'ui','approved-gallery.slint'),lines.join('\n')],
  [join(here,'src','gallery.rs'),rs.join('\n')],
  [join(here,'ui','APPROVED_GALLERY_INDEX.json'),JSON.stringify({
    schema:'challenger-native-verified-gallery.v1',totalShots:shots.length,
    projectsWithScreenshots:Object.keys(grouped).length,
    totalIcons:22+icons.length,independentSelectedProjects:selection.selected.length,
    independentSourceManifest:'independent-media.v1.json',
    icons,assets:shots},null,2)+'\n'],
  [join(here,'ui','INDEPENDENT_NATIVE_MEDIA_NOTICES.md'),notice.join('\n')+'\n'],
  [join(here,'ui','MEDIA_CREDITS.json'),JSON.stringify(creditsDocument,null,2)+'\n'],
  [join(here,'ui','MEDIA_CREDITS.md'),creditLines.join('\n')+'\n'],
];
for(const [filename,data] of outputs) {
  if(check) {
    // Git on Windows may check out generated text as CRLF; normalize only text.
    // All original/embedded binary screenshots still require byte-exact SHA-256.
    if(!existsSync(filename)||readFileSync(filename,'utf8').replace(/\r\n/g,'\n')!==data) {
      throw Error('Generated media index changed or missing: '+filename);
    }
  } else {
    writeFileSync(filename,data);
  }
}
console.log('APPROVED_GALLERY_SYNC_PASS mode='+ (check?'check':'write')+
  ' projects='+Object.keys(grouped).length+' frames='+shots.length+
  ' originalAssets='+files.length+' sourceReportedIcons='+(22+icons.length)+
  ' importedBytes='+files.reduce((n,p)=>n+readFileSync(join(here,'ui',p)).length,0));
