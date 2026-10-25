'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const {describe,create,claimsFor}=require('../platform-availability.js');
const app={repo:'infinite',reportedPlatforms:['Windows','macOS','Linux'],discovery:true,
 installable:false,downloadablePortable:false};
const adapters={infinite:{win32:{kind:'zip',asset:'^Infinite-windows-x64\\.zip$'},
 darwin:{kind:'dmg',asset:'^Infinite\\.dmg$'}}};
const portables={infinite:{win32:{kind:'zip',asset:'^Infinite-windows-x64\\.zip$'}}};
test('Windows/macOS Linux reported status is not equal to vetted install',()=>{
 const a=describe(app,{currentPlatform:'linux',currentArch:'arm64',adapters,portables});
 assert.equal(a.entries.win32.state,'adapter-reviewed');
 assert.equal(a.entries.darwin.state,'adapter-reviewed');
 assert.equal(a.entries.linux.state,'reported');
 assert.equal(a.entries.linux.installReady,false);
 assert.equal(a.autoInstallAllowed,false);
 assert.equal(a.currentArch,'arm64');
});
test('current OS install-ready only when backend has an exact approval',()=>{
 const a=describe({...app,installable:true},{currentPlatform:'darwin',adapters,portables});
 assert.equal(a.entries.darwin.state,'install-ready');
 assert.equal(a.entries.darwin.installApprovalRequired,true);
 assert.equal(a.entries.win32.state,'adapter-reviewed');
 assert.equal(a.entries.linux.state,'reported');
});
test('research-only items cannot get installation permission from forged source fields',()=>{
 const a=describe({...app,installable:true,downloadablePortable:true,researchPendingVerification:true},
  {currentPlatform:'win32',adapters,portables});
 assert.equal(a.entries.win32.installReady,false);
 assert.equal(a.entries.win32.portableReady,false);
 assert.equal(a.entries.win32.state,'adapter-reviewed');
});
test('no fabricated Linux compatibility from absent sources',()=>{
 const a=describe({repo:'totally-new',description:'AI native desktop with Linux inside a note',installable:false},
  {currentPlatform:'linux'});
 assert.equal(a.entries.linux.state,'unknown');
 assert.equal(a.entries.darwin.state,'unknown');
 assert.equal(a.entries.win32.state,'unknown');
});
test('recognizes curated platform labels, never implies a native installer',()=>{
 const a=describe({repo:'foo',reportedPlatforms:['macOS 26+, Apple silicon','Windows (less tested)','Ubuntu Linux','Web']},
  {currentPlatform:'linux'});
 for(const os of ['darwin','win32','linux'])assert.equal(a.entries[os].state,'reported');
 assert.deepEqual(claimsFor({reportedPlatforms:['macOS'],platforms:['Windows']}),['macOS','Windows']);
});
test('reads actual vetted adapter map and never grants Linux install',()=>{
 const local=create({root:path.resolve(__dirname,'..'),currentPlatform:'linux'});
 const a=local({...app,installable:false});
 assert.equal(a.entries.win32.reviewedInstaller,true);
 assert.equal(a.entries.darwin.reviewedInstaller,true);
 assert.equal(a.entries.linux.reviewedInstaller,false);
 assert.equal(a.entries.linux.installReady,false);
});
test('empty/partial map remains conservative',()=>{
 const a=describe(null,{currentPlatform:'win32',adapters:{},portables:{}});
 assert.equal(a.entries.win32.state,'unknown');
 assert.equal(Object.keys(a.entries).length,3);
});
