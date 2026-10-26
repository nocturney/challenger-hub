'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const slots=require('./native-beta-qa-slots.cjs');
const SHA='1234567890abcdef1234567890abcdef12345678';
const repo='velvet-workspace/challenger-hub';
let base,root;
function setup() {
  base=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'challenger-beta-unit-'));
  root=path.join(base,'Challenger-Beta-Slots-unit');
  slots.initialize(root);
}
function cleanup() { if(base)fs.rmSync(base,{recursive:true,force:true}); }
function fixture(id,version='0.1.0',modify={}) {
  const folder=path.join(root,'slots',id);
  fs.mkdirSync(folder,{recursive:true});
  const name='QA-arch-'+id+'.zip';
  const blob=Buffer.alloc(1_200_000,0x41);
  blob.set(Buffer.from([0x50,0x4b,0x03,0x04]),0);
  blob.set(Buffer.from(id),500);
  fs.writeFileSync(path.join(folder,name),blob);
  const sha=crypto.createHash('sha256').update(blob).digest('hex');
  const meta={schema:'challenger.portable.build.v1',repository:repo,
    channel:'temporary-developer-preview',publicRelease:false,
    noUserInstallation:true,appVersion:version,platform:'windows-x64',
    checkoutCommit:SHA,pullRequestHeadCommit:SHA,
    archiveFilename:name,archiveSha256:sha,archiveSizeBytes:blob.length,
    ...modify};
  fs.writeFileSync(path.join(folder,'BUILD_INFO.json'),JSON.stringify(meta));
  const portable=path.join(folder,'portable','ChallengerHubNativePreview-Win');
  fs.mkdirSync(portable,{recursive:true});
  fs.writeFileSync(path.join(portable,'challenger-slint-rust-host.exe'),'fake-for-test-never-executed');
  return {folder,name,meta};
}
test('two versioned QA slots can be verified, activated and rolled back without executing an app',async()=>{
  setup();
  try {
    fixture('v1','0.1.0');fixture('v2','0.2.0');
    const first=await slots.transaction(root,'v1');
    assert.equal(first.active.appVersion,'0.1.0');
    assert.equal(first.previous,null);
    const newer=await slots.transaction(root,'v2');
    assert.equal(newer.active.appVersion,'0.2.0');
    assert.equal(newer.previous.appVersion,'0.1.0');
    assert.equal(newer.revision,2);
    const rollback=await slots.transaction(root,'rollback');
    assert.equal(rollback.active.appVersion,'0.1.0');
    assert.equal(rollback.previous.appVersion,'0.2.0');
    assert.equal(rollback.revision,3);
    assert.equal(fs.readFileSync(path.join(root,'slots','v1','portable','ChallengerHubNativePreview-Win','challenger-slint-rust-host.exe'),'utf8'),'fake-for-test-never-executed');
    assert.equal(fs.readdirSync(root).includes('selection.lock'),false);
  }finally{cleanup();}
});
test('invalid roots or unknown old owner cannot be activated',async()=>{
  assert.throws(()=>slots.permittedRoot('/tmp/production-files'),/non-beta/);
  assert.throws(()=>slots.permittedRoot('/tmp/CraftSuite/Center/Challenger-Beta-Slots'),/production/);
  setup();
  try {
    fixture('old', '0.1.0',{repository:'nocturney/challenger-hub'});
    await assert.rejects(slots.verify(root,'old'),/canonical/);
    await assert.rejects(slots.transaction(root,'old'),/canonical/);
    assert.equal((await slots.stateReport(root)).active,null);
  }finally{cleanup();}
});
test('modified zip, public release and wrong platform are blocked before a version selection',async()=>{
  setup();
  try {
    const {folder,name}=fixture('bad');
    fs.appendFileSync(path.join(folder,name),Buffer.from('tamper'));
    await assert.rejects(slots.verify(root,'bad'),/size metadata mismatch/);
    const metaPath=path.join(folder,'BUILD_INFO.json');
    const meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));
    meta.archiveSizeBytes=fs.statSync(path.join(folder,name)).size;
    fs.writeFileSync(metaPath,JSON.stringify(meta));
    await assert.rejects(slots.verify(root,'bad'),/SHA-256 mismatch/);
    meta.publicRelease=true;fs.writeFileSync(metaPath,JSON.stringify(meta));
    await assert.rejects(slots.verify(root,'bad'),/non-public/);
    meta.publicRelease=false;meta.platform='linux-x64';fs.writeFileSync(metaPath,JSON.stringify(meta));
    await assert.rejects(slots.verify(root,'bad'),/Unsupported/);
  }finally{cleanup();}
});
test('invalid IDs, symlinked slot and interrupted lock never switch the selected version',async()=>{
  setup();
  try {
    fixture('good');
    await slots.transaction(root,'good');
    await assert.rejects(slots.transaction(root,'../production'),/Invalid slot/);
    fs.symlinkSync(path.join(root,'slots','good'),path.join(root,'slots','link'));
    await assert.rejects(slots.verify(root,'link'),/Symlink/);
    fs.writeFileSync(path.join(root,'selection.lock'),'stale');
    await assert.rejects(slots.transaction(root,'good'),/locked/);
    assert.equal((await slots.stateReport(root)).active.id,'good');
  }finally{cleanup();}
});
test('slot state refuses missing, corrupt or deleted previous version rather than announcing success',async()=>{
  setup();
  try {
    fixture('a');fixture('b');
    await slots.transaction(root,'a');
    await slots.transaction(root,'b');
    fs.unlinkSync(path.join(root,'slots','a','BUILD_INFO.json'));
    await assert.rejects(slots.transaction(root,'rollback'));
    const state=JSON.parse(fs.readFileSync(path.join(root,'active-slot.json'),'utf8'));
    assert.equal(state.active,'b');
    await assert.rejects(slots.stateReport(root));
  }finally{cleanup();}
});
