import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFromRealEngine,filterCatalog,categoriesOf,managedSignalFor} from './live-catalog.mjs';

test('real local backend supplies exactly the reviewed catalog with no scan or write actions',async()=>{
 const live=await readFromRealEngine();
 assert.equal(live.engineVersion,'4.0.0-desktop.preview.12');
 assert.equal(live.counts.managed,14);
 assert.equal(live.counts.curated,152);
 assert.equal(live.counts.research,15);
 assert.equal(live.items.length,181);
 assert.equal(new Set(live.items.map(x=>x.id)).size,181);
 assert.equal(live.networkScanDisabled,true);
 assert.equal(live.writeActionsExposed,false);
 assert.ok(live.items.some(x=>x.kind==='curated'));
 assert.ok(live.items.some(x=>x.kind==='research'));
 assert.ok(live.items.every(x=>!Object.hasOwn(x,'installReady')));
});
test('in-memory search, discipline filters and source are correct',async()=>{
 const live=await readFromRealEngine();
 const names=filterCatalog(live.items,'composa').map(x=>x.name);
 assert.deepEqual(names,['Composa']);
 assert.equal(filterCatalog(live.items,'not-really-a-real-project-abcxyz').length,0);
 assert.equal(filterCatalog(live.items).length,181);
 const cat=categoriesOf(live.items);
 assert.equal(cat[0],'All disciplines');
 assert.ok(cat.length>2);
 const first=cat[1];
 assert.ok(filterCatalog(live.items,'',first).every(x=>x.category===first));
 assert.ok(live.items.some(x=>x.source.includes('github.com')||x.source.includes('/')));
});
test('source seed text is UTF-8 and not double-decoded at the native bridge',async()=>{
 const live=await readFromRealEngine();
 const cad=live.items.find(p=>p.name==='CADCraft');
 const varve=live.items.find(p=>p.name==='Varve');
 assert.ok(cad?.summary.includes('drafting — an open-source'), 'CADCraft source em dash');
 assert.ok(varve?.summary.includes('Varve · Free Design Software'), 'Varve source middle dot');
 assert.ok(!live.items.some(p=>/â€”|Â·/.test(p.summary)), 'No known source mojibake');
});

test('managed inventory is scope-limited, read-only, and excludes unverified research',async()=>{
 const live=await readFromRealEngine();
 assert.equal(live.inventory.scope,'managed-only');
 assert.equal(live.inventory.source,'preview12-local-name-version-detector');
 assert.equal(live.inventory.method,'name-version-heuristic');
 assert.ok(Math.abs(Date.now()-live.inventory.checkedAtMs)<60000);
 const managed=live.items.filter(p=>p.kind==='managed');
 const others=live.items.filter(p=>p.kind!=='managed');
 assert.equal(managed.length,14);
 assert.equal(others.length,167);
 assert.ok(live.items.every(p=>!Object.hasOwn(p,'installedPath')));
 assert.ok(others.every(p=>!Object.hasOwn(p,'installedVersion') &&
   !Object.hasOwn(p,'managedInstallSignal') && !Object.hasOwn(p,'updateHint')));
 if(process.platform==='win32'||process.platform==='darwin'){
  assert.equal(live.inventory.status,'assessed');
  assert.equal(live.inventory.assessedManagedCount,14);
  assert.ok(managed.every(p=>['detected','not-detected'].includes(p.managedInstallSignal)));
 }else{
  assert.equal(live.inventory.status,'unsupported');
  assert.equal(live.inventory.assessedManagedCount,0);
  assert.ok(managed.every(p=>p.managedInstallSignal==='unsupported'));
 }
 assert.ok(managed.every(p=>!p.updateHint ||
   !!p.installedVersion && !!p.latestVersion && p.managedInstallSignal==='detected'));
});
test('managed OS signals never promote candidates or claim unsupported platforms',()=>{
 const entry={installedVersion:'2.0.0',latestVersion:'2.1.0',needsUpdate:true};
 assert.deepEqual(managedSignalFor(entry,'darwin'),{
  managedInstallSignal:'detected',installedVersion:'2.0.0',
  latestVersion:'2.1.0',updateHint:true
 });
 assert.deepEqual(managedSignalFor(entry,'linux'),{
  managedInstallSignal:'unsupported',installedVersion:'',
  latestVersion:'2.1.0',updateHint:false
 });
 assert.equal(managedSignalFor({...entry,installedVersion:null},'win32').updateHint,false);
 assert.equal(managedSignalFor({...entry,needsUpdate:false},'darwin').updateHint,false);
});
