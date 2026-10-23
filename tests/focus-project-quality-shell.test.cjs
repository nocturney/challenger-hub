'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),quality=require('../project-quality');
const projects=require('../challengers.json').projects;
const seeded=JSON.parse(fs.readFileSync(path.join(root,'tools','desktop-build','seeds','curated-metadata.preview8.json'),'utf8')).items;
function evaluate(p){
 const source=seeded[p.id]||{};
 return quality.assess({reviewStatus:p.reviewStatus,summary:p.summary,challenges:p.challenges,
  reportedPlatforms:p.reportedPlatforms,license:p.license,officialLicense:source.officialLicense,
  sourceDescription:source.sourceDescription,repositoryMetadataCheckedAt:source.lastObservedAt});
}
test('User-facing completeness gate leaves 72 useful independent profiles and hides 80 pending further details',()=>{
 const counts=projects.map(evaluate).reduce((a,s)=>(a[s.profileTier]=(a[s.profileTier]||0)+1,a),{});
 assert.deepEqual(counts,{documented:72,'needs-details':7,research:73});
});
test('Missing platform is a real research gap, not silently replaced with the current operating system',()=>{
 const a=projects.find(x=>x.id==='dune3d');const q=evaluate(a);
 assert.equal(q.profileTier,'needs-details');
 assert.ok(q.profileCompleteness.missing.includes('Supported platforms'));
});
test('A useful profile with no recognized GitHub license is not misrepresented as installation-approved',()=>{
 const a=projects.find(x=>x.id==='baserow'),q=evaluate(a);
 assert.equal(q.profileTier,'documented');
 assert.equal(q.profileCompleteness.licenseKnown,false);
 assert.equal(q.profileCompleteness.licenseSource,'Not established');
});
test('Research candidates never become approved just because the upstream repo contains a description',()=>{
 const r=projects.find(x=>x.reviewStatus==='research-candidate-unverified'),q=evaluate(r);
 assert.equal(q.profileTier,'research');
});
test('Metadata is refreshed from authenticated official repository facts for all curated projects',()=>{
 const rows=Object.values(seeded);
 assert.equal(rows.length,152);
 assert.equal(rows.filter(x=>x.sourceDescription).length,152);
 assert.equal(rows.filter(x=>x.officialLicense).length,101);
 assert.ok(rows.filter(x=>x.topics?.length).length>120);
 assert.ok(rows.filter(x=>x.officialHomepage).length>100);
});
test('The SlicerBridge window shell begins normal and fits the Windows work area',()=>{
 const code=fs.readFileSync(path.join(root,'tools','desktop-build','build-onefile-windows-preview8.cjs'),'utf8'),
       css=fs.readFileSync(path.join(root,'tools','desktop-build','slice-shell.css'),'utf8');
 assert.ok(code.includes('Screen.PrimaryScreen?.WorkingArea'));
 assert.ok(code.includes('WindowState = FormWindowState.Normal'));
 assert.ok(!code.includes('WindowState = FormWindowState.Maximized'));
 assert.ok(css.includes('height:100dvh')&&css.includes('overflow:hidden'));
 assert.ok(css.includes('.disciplines{')&&css.includes('overflow-y:auto'));
});
test('Research toggle is explicit and never edits actual release/install authorization',()=>{
 const ui=fs.readFileSync(path.join(root,'tools','desktop-build','project-quality-ui.js'),'utf8'),
       server=fs.readFileSync(path.join(root,'server.js'),'utf8');
 assert.ok(ui.includes("ui.includeIncomplete=false"));
 assert.ok(ui.includes("a.profileTier==='documented'"));
 assert.ok(ui.includes('Show research'));
 assert.ok(server.includes('projectQuality.assess(enriched)'));
 assert.ok(server.includes('installAdapter:null,installable:false'));
});
