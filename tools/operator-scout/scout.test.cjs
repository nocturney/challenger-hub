'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {rank,shortlist,queries,knownRepos,argsOf,safeOutput,markdown,kindOf}=require('./scout.cjs');
const now=Date.parse('2026-10-23T16:00:00Z');
function sample(name,created='2026-09-20T09:00:00Z',extra={}){
 return {full_name:name,description:'AI-native local-first creative desktop editor with agent workflow and procedural tools',
  created_at:created,pushed_at:'2026-10-22T12:00:00Z',
  stargazers_count:130,topics:['editor','ai','local-first'],license:{spdx_id:'MIT'},
  language:'TypeScript',has_issues:true,fork:false,archived:false,disabled:false,...extra};
}
test('novel active project scores above old established software',()=>{
 const young=rank(sample('tinyteam/creative-desktop'),now);
 const old=rank(sample('legacy/very-old-editor','2018-01-02T10:00:00Z',
  {stargazers_count:50000,pushed_at:'2024-01-01T00:00:00Z'}),now);
 assert.ok(young.score>old.score+40);
 assert.equal(young.installable,false);
 assert.equal(young.review,'pending-operator-review');
 assert.match(young.why.join(' '),/not proof of AI-built origin/i);
});
test('skip archived, forks and malformed source names',()=>{
 assert.equal(rank(sample('tinyteam/fork','2026-10-01T00:00:00Z',{fork:true}),now),null);
 assert.equal(rank(sample('tinyteam/archived','2026-10-01T00:00:00Z',{archived:true}),now),null);
 assert.equal(rank(sample('bad repo','2026-10-01T00:00:00Z'),now),null);
});
test('exclude existing catalog, obvious apps; collapse duplicates from search topics',()=>{
 const batches=[
  {focus:'first',items:[sample('fresh/novel-app'),sample('blender/blender')]},
  {focus:'second',items:[sample('fresh/novel-app'),sample('already/curated'),sample('second/novel-app')]}
 ];
 const list=shortlist(batches,{known:new Set(['blender/blender','already/curated']),max:10,now});
 assert.deepEqual(new Set(list.map(x=>x.repository)),new Set(['fresh/novel-app','second/novel-app']));
});
test('actual Preview10 registry and watchlist both suppressed by default',()=>{
 const known=knownRepos();
 assert.ok(known.has('freecad/freecad'));
 assert.ok(known.has('genspark-ai/genoffice'));
 assert.ok(known.has('robbietilton/compositor'));
});
test('queries only recent upstream candidates and do not seek install permissions',()=>{
 const q=queries(6,new Date('2026-10-23T00:00:00Z'));
 assert.ok(q.length>=8);
 assert.ok(q.every(x=>x.q.includes('created:>=2026-04-23')));
 assert.ok(q.every(x=>x.q.includes('fork:false archived:false')));
});
test('reject output inside public Git repo; accept per-user operator folder',()=>{
 assert.throws(()=>safeOutput(path.resolve(__dirname,'../../scout-reports')),/cannot be written inside/);
 assert.doesNotThrow(()=>safeOutput(path.join(process.env.TEMP||'C:\\Temp','operator-only')));
});
test('safe CLI contract and pure Markdown report',()=>{
 assert.equal(argsOf(['--months','6','--limit','15']).months,6);
 assert.throws(()=>argsOf(['--months','0']),/months/);
 assert.throws(()=>argsOf(['--unknown']),/Unsupported/);
 const md=markdown({generatedAt:'2026-10-23',candidates:[rank(sample('fresh/tool'),now)],errors:[]});
 assert.match(md,/Nothing has been imported/);
 assert.match(md,/fresh\/tool/);
});
test('desktop/integration classification keeps SDKs separate from installable apps',()=>{
 assert.equal(kindOf(sample('creative/studio')), 'desktop');
 assert.equal(kindOf(sample('creator/bridge','2026-10-01',{description:'MCP plugin bridge and Python SDK'})), 'integration');
});

test('avoid listicles, curriculum and guide-only sources even when README keywords matched',()=>{
 for(const description of [
  'A collection of remote MCP servers for people working with AI agents',
  'Master curriculum for advanced AI software development and engineering',
  'MusicGen Pro Trainer 2026: The Ultimate AI Music Studio Guide'
 ])assert.equal(rank(sample('noise/not-a-product','2026-10-01',{description}),now),null);
});
