'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {makeScanner,allTasks,sourcesFor,atomRelease,parseResponse}=require('../source-scanner');
const projects=JSON.parse(fs.readFileSync(path.join(__dirname,'../challengers.json'),'utf8')).projects;
const craftNames=['photocraft','vectorcraft','lightcraft','filmcraft','effectcraft','designcraft','pdfcraft','wordcraft','gridcraft','deckcraft','cadcraft','soundcraft'];
const rows=[
 ...craftNames.map(id=>({id,repository:'storytold/'+id,kind:'craft'})),
 ...projects.map(p=>({id:p.id,repository:p.repository,kind:'independent'}))
];
function response(status,body='',etag='"test-1"'){
 return {status,ok:status>=200&&status<300,headers:{get(n){
  if(n==='content-length')return String(Buffer.byteLength(body));
  if(n==='etag')return etag;
  if(n==='last-modified')return 'Sat, 10 Oct 2026 12:00:00 GMT';
  return null;
 }},async text(){return body}};
}
function atom(repo,tag){
 return '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><link rel="alternate" href="https://github.com/'+repo+'/releases/tag/'+tag+'"/></entry></feed>';
}
function makeMock(){
 const calls=[],verified=[];
 let version='v1.0.0',gitHubDown=false;
 const fetcher=async(url,options)=>{
  calls.push({url,etag:options.headers['If-None-Match']||null});
  if(url.includes('invent.kde.org'))return response(200,JSON.stringify([{tag_name:'0.5.4',name:'0.5.4'}]),'"kde-release"');
  if(url.includes('gitlab.com')&&url.includes('/releases?'))return response(200,'[]','"gitlab-releases"');
  if(url.includes('gitlab.com')&&url.includes('/tags?'))return response(200,JSON.stringify([{name:'v1.9.0'}]),'"gitlab-tags"');
  if(url.includes('codeberg.org'))return response(200,JSON.stringify([{name:'release-24.02.2-alpha2'}]),'"codeberg-tags"');
  if(url.includes('github.com/')){
   if(gitHubDown&&url.includes('/stargatedaw/stargate/'))return response(429,'');
   if(options.headers['If-None-Match']&&version==='v1.0.0')return response(304,'');
   return response(200,atom(url.slice('https://github.com/'.length).split('/releases.atom')[0],version),'"github-'+version+'"');
  }
  throw Error('Unexpected URL in fake source '+url);
 };
 return {fetcher,calls,verified,setVersion:v=>version=v,setGitHubDown:v=>gitHubDown=v};
}
function tmp(){return fs.mkdtempSync(path.join(os.tmpdir(),'challenger-fair-'));}
test('all 91 products receive one uniform source queue slot',()=>{
 const tasks=allTasks(rows);
 assert.equal(rows.length,91);
 assert.equal(tasks.length,92);
 assert.equal(tasks.filter(x=>x.kind==='craft').length,12);
 assert.equal(tasks.filter(x=>x.kind==='independent').length,79);
 assert.equal(tasks.filter(x=>x.kind==='directory').length,1);
 assert.equal(new Set(tasks.map(x=>x.id)).size,tasks.length);
 for(const t of tasks.filter(x=>x.kind!=='directory'))assert.ok(sourcesFor(t).length);
});
test('official source feeds are typed: mirrors and tags cannot become install approvals',()=>{
 const byId=id=>rows.find(x=>x.id===id);
 assert.equal(sourcesFor(byId('glaxnimate'))[0].host,'invent.kde.org');
 assert.equal(sourcesFor(byId('zrythm'))[0].host,'gitlab.com');
 assert.equal(sourcesFor(byId('stargate-daw')).some(x=>x.host==='codeberg.org'),true);
 const gh=sourcesFor(byId('photocraft'))[0];
 assert.equal(gh.kind,'github-atom');
 assert.equal(atomRelease(atom('storytold/photocraft','v1.2.0'),'storytold/photocraft').type,'release');
 assert.equal(atomRelease(atom('storytold/photocraft','v2.0.0-beta1'),'storytold/photocraft').type,'tag');
 assert.equal(parseResponse(sourcesFor(byId('zrythm'))[1],JSON.stringify([{name:'v1.9.0'}])).type,'tag');
});
test('round-robin scans all projects once before any repeats; changed versions get bounded verification signals',async()=>{
 const root=tmp();
 try{
  const mock=makeMock();
  let clock=Date.parse('2026-10-10T12:00:00Z');
  const scanner=makeScanner({
   root,list:()=>rows,clock:()=>clock,disableTimers:true,
   config:()=>({autoCheck:true,intervalHours:12}),fetcher:mock.fetcher,
   knownTag:e=>e.id==='glaxnimate'?'0.5.4':e.id==='zrythm'?'v1.9.0':'v1.0.0',
   discovery:async()=>true,
   onChange:async event=>{mock.verified.push(event);return false}
  });
  const first=[];
  for(let i=0;i<92;i++){const x=await scanner.tick();assert.equal(x.skipped,undefined);first.push(x.id)}
  assert.equal(new Set(first).size,92);
  assert.equal(mock.verified.length,0,'Do not hit GitHub API to verify an unchanged baseline');
  assert.equal(scanner.status().checked,91);
  assert.equal(scanner.status().due,0);
  assert.equal((await scanner.tick()).skipped,true);
  assert.equal(scanner.publicSignal('glaxnimate').signalType,'release');
  assert.equal(scanner.publicSignal('zrythm').signalType,'tag');
  assert.equal(scanner.publicSignal('zrythm').unverified,true);
  assert.equal(scanner.publicSignal('stargate-daw').signalType,'release');
  clock+=13*3600*1000;
  mock.setVersion('v1.1.0');
  const second=[];
  for(let i=0;i<92;i++){const x=await scanner.tick();assert.equal(x.skipped,undefined);second.push(x.id)}
  assert.equal(new Set(second).size,92);
  assert.equal(scanner.status().due,0);
  assert.ok(mock.verified.some(x=>x.id==='photocraft'&&x.tag==='v1.1.0'));
  assert.ok(scanner.publicSignal('photocraft').verificationPending);
  assert.equal(scanner.publicSignal('zrythm').signalTag,'v1.9.0');
  assert.equal(mock.calls.some(x=>x.url.includes('api.github.com')),false);
  const replay=scanner.requestAll();
  assert.equal(replay.queued,92);
  assert.equal(scanner.requestAll().cooldown,true);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('stale mirror source tag never overwrites a previously published release',async()=>{
 const root=tmp();
 try{
  let clock=Date.parse('2026-10-10T12:00:00Z');
  const fake=makeMock();
  const scanner=makeScanner({
   root,disableTimers:true,list:()=>[rows.find(x=>x.id==='stargate-daw')],
   config:()=>({autoCheck:true,intervalHours:12}),clock:()=>clock,
   fetcher:fake.fetcher,discovery:async()=>true,
   knownTag:()=> 'v1.0.0'
  });
  await scanner.tick();
  await scanner.tick();
  assert.equal(scanner.publicSignal('stargate-daw').signalTag,'v1.0.0');
  clock+=13*3600*1000;
  fake.setGitHubDown(true);
  await scanner.tick();
  await scanner.tick();
  const signal=scanner.publicSignal('stargate-daw');
  assert.equal(signal.signalTag,'v1.0.0');
  assert.equal(signal.signalType,'release');
  assert.equal(signal.sourceHost,'github.com');
  assert.equal(scanner.readSnapshot().items['stargate-daw'].mirrorTag,'release-24.02.2-alpha2');
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
