'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('tools/desktop-build/project-discovery-ui-preview10.js');
const adapter=read('tools/desktop-build/new-source-records-preview10.js');
const build=read('tools/desktop-build/build-runtime.cjs');
const update=read('tools/desktop-build/hub-update-ui-preview10.js');
const style=read('tools/desktop-build/quiet-footer-preview10.css');
const seed=JSON.parse(read('tools/desktop-build/seeds/catalog-candidates.preview10.json'));
const old=JSON.parse(read('tools/desktop-build/seeds/catalog-candidates.preview9.json'));
test('all source-listed products are discoverable without a hidden research gate',()=>{
 assert.ok(js.includes('function isShown(a){return true}'));
 assert.ok(js.includes('function useful(){return projects.filter(isShown)}'));
 assert.ok(!js.includes("data-quality-research"));
 assert.ok(!js.includes('researchToggle'));
 assert.ok(js.includes("projects.length+' SOURCE-LINKED ENTRIES"));
 assert.ok(js.includes("New find · details evolving"));
});
test('source candidates join normal search and are never install-approved',()=>{
 assert.equal(old.candidates.length,14);
 assert.equal(seed.summary.verified,15);
 assert.equal(seed.candidates.length,15);
 assert.equal(seed.candidates.filter(x=>x.installable===false&&x.installerAdapter===null).length,15);
 assert.equal(new Set(seed.candidates.map(x=>x.repository.toLowerCase())).size,15);
 assert.ok(seed.candidates.some(x=>x.repository==='genspark-ai/genoffice'));
 assert.ok(seed.candidates.some(x=>x.repository==='dcc-mcp/dcc-mcp-core'));
 assert.ok(adapter.includes('sourceCandidatesForDiscovery(existing)'));
 assert.ok(adapter.includes('installable:false,installAdapter:null,installerAdapter:null'));
 assert.ok(adapter.includes("repo:'candidate-'+a.id"));
 assert.ok(build.includes('sourceCandidatesForDiscovery(current)'));
 assert.ok(build.includes("ui.scope==='new'&&!!a.candidateWatch"));
});
test('GenOffice source metadata was checked, not conflated with paid AI access',()=>{
 const e=seed.candidates.find(x=>x.repository==='genspark-ai/genoffice');
 assert.equal(e.repoUrl,'https://github.com/genspark-ai/genoffice');
 assert.equal(e.officialLicense,'Apache-2.0');
 assert.ok(e.latestPublishedStableTag?.startsWith('v0.12.'));
 assert.ok(e.whyReview.includes('AI-provider access may require paid credentials'));
 assert.equal(e.assessment,'new-unreviewed');
 assert.equal(e.platformsConfirmed,false);
});
test('Challenger version and Hub update control is moved to footer, no automatic check',()=>{
 assert.ok(build.includes("html=one(html,hub[0],'','remove expanding header update status')"));
 assert.ok(build.includes("'<footer class=\"global-footer\">'+hub[0]"));
 assert.ok(style.includes('.global-header .connection-state{display:none!important}'));
 assert.ok(style.includes('flex-wrap:nowrap!important'));
 assert.ok(style.includes('.global-footer .hub-version'));
 assert.ok(update.includes("const preview='10'"));
 assert.ok(!update.includes("setTimeout(()=>void check(false),2400)"));
 assert.ok(!update.includes('Hub is current'));
 assert.ok(update.includes('No newer release available'));
});
test('Archive status remains transparent without being used as a visibility filter',()=>{
 assert.ok(js.includes("if(a.repositoryHealth?.state==='archived')"));
 assert.ok(js.includes('GitHub repository archived by maintainer'));
 assert.ok(js.includes("function isShown(a){return true}"));
 assert.ok(!js.includes('excluded from standard browsing'));
});
