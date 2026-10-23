'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),base=path.join(root,'tools','preview-build');
const data=JSON.parse(fs.readFileSync(path.join(base,'media-source','project-media.v1.json'),'utf8'));
const official=require(path.join(root,'official-icons.json')).projects;
const curated=require(path.join(root,'challengers.json')).projects;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
test('curated media schema, membership and confidence separated',()=>{
 assert.equal(data.schema,'challenger-project-media.v1');
 const known=new Set(curated.map(p=>p.id));
 assert.equal(Object.keys(data.projects).length,14);
 for(const [id,item] of Object.entries(data.projects)){
  assert.ok(known.has(id),'media-only repo not in catalog: '+id);
  assert.equal(item.repo,curated.find(p=>p.id===id).repository);
  assert.ok(['pending','icon-only','approved'].includes(item.status));
  if(item.icon)assert.ok(['source-confirmed','official-file-confirmed'].includes(official[id].status));
  assert.ok(!Object.prototype.hasOwnProperty.call(item,'installAdapter'));
  assert.ok(!Object.prototype.hasOwnProperty.call(item,'reviewStatus'));
 }
});
test('only checksummed creator-linked local icons are packaged',()=>{
 const valid=Object.values(data.projects).filter(p=>p.icon);
 assert.ok(valid.length>=1);
 for(const p of valid){
  const i=p.icon;
  assert.match(i.path,/^\/media\/icons\/[a-z0-9-]+\.(png|svg|ico|webp|jpg|jpeg)$/);
  assert.equal(i.status,'approved');
  assert.ok(/^https:\/\/raw\.githubusercontent\.com\//.test(i.source));
  assert.ok(p.license?.spdx&&p.license?.url);
  const file=path.join(base,'media-source','assets',i.path.replace('/media/',''));
  const bytes=fs.readFileSync(file);
  assert.equal(bytes.length,i.size);
  assert.equal(hash(bytes),i.sha256);
  if(i.path.endsWith('.svg')){
   const xml=bytes.toString('utf8');
   assert.ok(xml.includes('<svg'));
   assert.doesNotMatch(xml,/<script|<foreignobject|\son\w+\s*=|javascript:|<iframe|<object|<embed|@import|url\s*\(\s*["']?https?:/i);
  }
 }
});
test('Dune 3D screenshot is original SHA256-pinned source bytes',()=>{
 const item=data.projects.dune3d,s=item.screenshot;
 assert.equal(s.type,'application-ui-screenshot');
 assert.equal(s.status,'approved');
 assert.equal(s.source,'https://raw.githubusercontent.com/dune3d/dune3d/main/screenshot.png');
 assert.match(s.reference,/github.com\/dune3d\/dune3d/);
 assert.ok(s.width>=600&&s.height>=350&&s.licenseSpdx.startsWith('GPL-'));
 const b=fs.readFileSync(path.join(base,'media-source','assets','screenshots','dune3d.png'));
 assert.equal(hash(b),s.sha256);
 assert.equal(b.readUInt32BE(16),s.width);
 assert.equal(b.readUInt32BE(20),s.height);
});
test('17 domain icons, safe image fallback and no direct third-party requests',()=>{
 const src=fs.readFileSync(path.join(base,'project-media-runtime.js'),'utf8');
 const ctx={window:{CHALLENGER_PROJECT_MEDIA:{}},document:{addEventListener(){}},HTMLImageElement:function(){},domainOf:a=>a.category||'Office & Productivity'};
 vm.createContext(ctx);
 const result=vm.runInContext(src+'\n({domainCount:Object.keys(DOMAIN_MARKS).length,untrusted:mediaIcon({repo:"missing",title:"Missing",category:"Design & Imaging"},"row")})',ctx);
 assert.equal(result.domainCount,17);
 assert.ok(result.untrusted.includes('icon-fallback'));
 assert.ok(result.untrusted.includes('svg'));
 assert.doesNotMatch(src,/fetch\s*\(|XMLHttpRequest|localStorage|navigator\.sendBeacon/);
});
test('preview v2 assembly remains isolated and fail-closed',()=>{
 const src=fs.readFileSync(path.join(base,'build-media-v2.cjs'),'utf8');
 assert.match(src,/PREVIEW-4\.0\.0-orbit\.1/);
 assert.match(src,/PREVIEW-4\.0\.0-orbit\.2/);
 assert.match(src,/if\(fs\.existsSync\(dest\)\)throw Error/);
 assert.match(src,/SHA256-MANIFEST/);
 assert.match(src,/READ_ONLY_OFFLINE_PREVIEW/);
 assert.match(src,/routes\[entry\.route\]='media\/'\+entry\.rel/);
});
