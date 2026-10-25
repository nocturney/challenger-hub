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
    copyFileSync(sourcePath,output);
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
if(shots.length!==50||files.length!==47)throw Error('Expected 3 curated + 47 Craft screenshots');
const firsts=shots.filter(s=>s.index===0);
const q=s=>JSON.stringify(s);
const lines=[
  '// AUTO-GENERATED by sync-approved-gallery.mjs; no invented imagery.',
  '// Every @image-url path is bound to the pinned/checksummed media manifests.',
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
    '    Text { text: '+q(s.caption)+'; color: root.caption-color; font-size: 11px; height: 25px; overflow: elide; }',
    '  }');
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
  '#[cfg(test)]',
  'mod tests {',
  '    use super::*;',
  '    #[test]',
  '    fn pinned_gallery_has_exact_50_approved_frames_and_safe_sources() {',
  '        let all: Vec<(&str,i32)> = vec![');
for(const [key,entries] of Object.entries(grouped))rs.push('            ('+q(key)+', '+entries.length+'),');
rs.push('        ];',
  '        assert_eq!(all.iter().map(|(_,n)| n).sum::<i32>(), 50);',
  '        for (media,n) in all {',
  '            assert_eq!(count(media),n);',
  '            for index in 0..n {',
  '                assert!(source(media,index).unwrap().starts_with("https://github.com/"));',
  '            }',
  '            assert_eq!(source(media,n),None);',
  '        }',
  '        assert_eq!(count("research:unverified"),0);',
  '        assert_eq!(source("craft-pdfcraft",99),None);',
  '    }',
  '}', '');
const outputs=[
  [join(here,'ui','approved-gallery.slint'),lines.join('\n')],
  [join(here,'src','gallery.rs'),rs.join('\n')],
  [join(here,'ui','APPROVED_GALLERY_INDEX.json'),JSON.stringify({
    schema:'challenger-native-verified-gallery.v1',totalShots:shots.length,
    projectsWithScreenshots:Object.keys(grouped).length,assets:shots},null,2)+'\n'],
];
for(const [filename,data] of outputs) {
  if(check) {
    if(!existsSync(filename)||readFileSync(filename,'utf8')!==data) {
      throw Error('Generated media index changed or missing: '+filename);
    }
  } else {
    writeFileSync(filename,data);
  }
}
console.log('APPROVED_GALLERY_SYNC_PASS mode='+ (check?'check':'write')+
  ' projects='+Object.keys(grouped).length+' frames='+shots.length+
  ' newNativeAssets='+files.length+
  ' importedBytes='+files.reduce((n,p)=>n+readFileSync(join(here,'ui',p)).length,0));
