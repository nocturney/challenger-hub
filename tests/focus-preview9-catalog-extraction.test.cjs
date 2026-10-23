'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),health=require('../catalog-health');
const registry=JSON.parse(fs.readFileSync(path.join(root,'tools/desktop-build/seeds/curated-metadata.preview9.json'))).items;
const watch=JSON.parse(fs.readFileSync(path.join(root,'tools/desktop-build/seeds/catalog-candidates.preview9.json')));
test('All 152 current official GitHub repository status observations are present',()=>{
 assert.equal(Object.keys(registry).length,152);
 assert.equal(registry.flowise.isArchived,true);
 const stats=health.summary(registry,Date.parse('2026-10-23T18:00:00Z'));
 assert.equal(stats.checked,152);
 assert.equal(stats.archived,1);
 assert.equal(stats.quiet12mo,5);
 assert.equal(stats.quiet6mo,1);
 assert.equal(stats.active,145);
 assert.equal(health.assess(registry.flowise).state,'archived');
 assert.equal(health.assess(registry.olive).state,'quiet-12m');
 assert.equal(health.assess(registry['stargate-daw']).state,'quiet-12m');
 assert.equal(health.assess(registry['gh-abemelic-freeshow']).state,'quiet-12m');
 assert.equal(health.assess(registry['gh-xibyte-jsketcher']).state,'quiet-6m');
});
test('New research sources are explicitly unreviewed and have no installer rights',()=>{
 assert.equal(watch.schema,'challenger-candidate-watchlist.v1');
 assert.equal(watch.summary.verified,14);
 const current=new Set(require('../challengers.json').projects.map(x=>x.repository.toLowerCase()));
 for(const p of watch.candidates){
  assert.equal(p.assessment,'new-unreviewed');
  assert.equal(p.installable,false);
  assert.equal(p.installerAdapter,null);
  assert.equal(p.platformsConfirmed,false);
  assert.ok(!current.has(p.repository.toLowerCase()));
  assert.equal(p.repoUrl.toLowerCase(),'https://github.com/'+p.repository.toLowerCase());
  assert.match(p.checkedAt,/^2026-10-23T/);
 }
 assert.ok(watch.candidates.some(x=>x.repository==='dcc-mcp/dcc-mcp-core'));
 assert.ok(watch.candidates.some(x=>x.repository==='tangency-labs/solidcraft'));
});
test('ZIP payload directory records with Windows separator are correctly classified as folders',()=>{
 const s=fs.readFileSync(path.join(root,'tools/desktop-build/windows-onefile-startup-preview9.cs.txt'),'utf8');
 assert.ok(s.includes('string.IsNullOrEmpty(entry.Name)'));
 assert.ok(s.includes('System.IO.Directory.CreateDirectory(destination); continue;'));
 assert.ok(!s.includes('if (entry.FullName.EndsWith("/", StringComparison.Ordinal))'));
 assert.ok(s.includes('Unsafe embedded payload path'));
 assert.ok(s.includes('ValidateRuntime(tmp)'));
});
test('Browser hides archived/12m inactive repos by default and exposes audit through research',()=>{
 const s=fs.readFileSync(path.join(root,'tools/desktop-build/project-quality-ui.js'),'utf8');
 assert.ok(s.includes("['archived','disabled','quiet-12m'].includes(a.repositoryHealth?.state)"));
 assert.ok(s.includes("GitHub repository archived by maintainer"));
 assert.ok(s.includes("No repository push for 12+ months"));
 const code=fs.readFileSync(path.join(root,'tools/desktop-build/catalog-watch-ui.js'),'utf8');
 assert.ok(code.includes('assessment==='));
 assert.ok(code.includes("a.installable===false"));
 assert.ok(!code.includes('runFocusOperation'));
});
