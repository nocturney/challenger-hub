'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),base=path.join(root,'tools','preview-build');
const data=JSON.parse(fs.readFileSync(path.join(base,'media-source','project-media.v1.json'),'utf8'));
const checksums=Object.entries(data.projects).filter(([k,p])=>p.screenshot);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('Exactly three manually-audited creator-controlled app interface screenshots in initial release',()=>{
 const names=checksums.map(([id])=>id).sort();
 assert.deepEqual(names,['dune3d','material-maker','real-video-enhancer']);
 for(const [id,p] of checksums){
  const s=p.screenshot,rel=s.path.replace('/media/','');
  assert.equal(s.status,'approved');
  assert.equal(s.type,'application-ui-screenshot');
  assert.equal(s.sourceRepository.toLowerCase(),p.repo.toLowerCase());
  assert.match(s.sourceCommit,/^[a-f0-9]{40}$/);
  assert.equal(s.source,'https://raw.githubusercontent.com/'+s.sourceRepository+'/'+s.sourceCommit+
    '/'+({dune3d:'screenshot.png','material-maker':'material_maker/doc/images/screenshot.png',
       'real-video-enhancer':'screenshots/settings.png'})[id]);
  assert.match(s.reference,/^https:\/\/github\.com\//);
  assert.ok(s.reference.includes(s.sourceCommit));
  assert.equal(s.licenseSpdx,p.license.spdx);
  assert.equal(s.licenseUrl,p.license.url);
  assert.equal(s.path,'/media/screenshots/'+id+'.png');
  assert.match(s.provenance,/visually checked as real application UI/);
  assert.ok(s.width>=600&&s.height>=350&&s.width*s.height<=18000000);
  const buf=fs.readFileSync(path.join(base,'media-source','assets',rel));
  assert.equal(buf.length,s.size);
  assert.equal(sha(buf),s.sha256);
  assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(buf.readUInt32BE(16),s.width);
  assert.equal(buf.readUInt32BE(20),s.height);
 }
});
test('Repository license copies and notices exist for every bundled image',()=>{
 const notices=fs.readFileSync(path.join(base,'media-source','THIRD_PARTY_MEDIA_NOTICES.md'),'utf8');
 for(const [id,p] of Object.entries(data.projects)){
  if(!p.icon&&!p.screenshot)continue;
  assert.match(p.license.localCopy,/^licenses\/[a-z0-9-]+\.txt$/);
  const license=fs.readFileSync(path.join(base,'media-source',p.license.localCopy));
  assert.ok(license.length>100);
  assert.ok(notices.includes(id+' icon:'));
  if(p.screenshot)assert.ok(notices.includes(id+' authentic app UI:'));
 }
});
test('Generic builder is numbered, isolated, and refuses downgrade or overwrite',()=>{
 const src=fs.readFileSync(path.join(base,'build-media.cjs'),'utf8');
 assert.match(src,/Number\.isInteger\(preview\)/);
 assert.match(src,/preview<3/);
 assert.match(src,/PREVIEW-4\.0\.0-orbit\.1/);
 assert.match(src,/PREVIEW-4\.0\.0-orbit\.'\+preview/);
 assert.match(src,/if\(fs\.existsSync\(dest\)\)throw Error/);
 assert.match(src,/READ_ONLY_OFFLINE_PREVIEW/);
 assert.match(src,/screenshots<3/);
 assert.match(src,/SHA256-MANIFEST/);
 assert.doesNotMatch(src,/execSync|eval\(|child_process/);
});
test('Publishing requires real browser QA on both hosts, two ZIP assets, prerelease only',()=>{
 const src=fs.readFileSync(path.join(base,'release-preview.cjs'),'utf8');
 for(const gate of ['browser-qa-media.json','SHA256-MANIFEST.json','repo','requireCleanGit',
  'readOnly','noWrites','externalRequests','errors?.length','screenshotsCaptured<34',
  'for(const suffix of [','--prerelease','--draft','--draft=false','preview<3']){
  assert.ok(src.includes(gate),'Missing release safety gate: '+gate);
 }
 assert.match(src,/if\(!rel\.draft\|\|!rel\.prerelease\)/);
 assert.match(src,/assets\.size!==2/);
 assert.match(src,/GitHub digest differs from local validated Windows archive/);
 assert.doesNotMatch(src,/\bmerge\b.*pull_request|--latest\b/);
});
