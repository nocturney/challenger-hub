'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const at=app.indexOf('function latestQueueOutcomes(){'),end=app.indexOf('function renderQueueDialog(){');
assert.ok(at>0&&end>at);
const pure=app.slice(at,end);
function run(history){
 const state={history},context={state,htmlDate:s=>Date.parse(s||'')||0,Date};
 const f=vm.runInNewContext(pure+'\n({queueErrors,queueStage,latestQueueOutcomes})',context);
 return f;
}
const atTime=n=>new Date(Date.UTC(2026,9,10,12,0,n)).toISOString();
test('older failed update is resolved by a later success on the same app',()=>{
 const history=[
  {repo:'wordcraft',kind:'error',message:'error — 403',time:atTime(1)},
  {repo:'cadcraft',kind:'error',message:'Installation failed',time:atTime(2)},
  {repo:'wordcraft',kind:'success',message:'Successfully installed 0.4.0',time:atTime(3)}
 ];
 assert.deepEqual([...run(history).queueErrors()].map(x=>x.repo),['cadcraft']);
 history.push({repo:'cadcraft',kind:'success',message:'Success',time:atTime(4)});
 assert.equal(run(history).queueErrors().length,0);
});
test('a newly occurring failure after success requires attention',()=>{
 const history=[
  {repo:'cadcraft',kind:'error',message:'error — 403',time:atTime(1)},
  {repo:'cadcraft',kind:'success',message:'installed',time:atTime(2)},
  {repo:'cadcraft',kind:'error',message:'Installation incomplete',time:atTime(3)}
 ];
 assert.equal(run(history).queueErrors().length,1);
 assert.equal(run(history).queueErrors()[0].time,atTime(3));
});
test('exact job labels rely on reported installation phase, not invented percentages',()=>{
 const f=run([]).queueStage;
 assert.equal(f({state:'downloading'}),'Downloading');
 assert.equal(f({state:'verified'}),'Verifying');
 assert.equal(f({state:'installing'}),'Installing');
 assert.equal(f({mode:'update',state:'running'}),'Updating');
 assert.equal(f({mode:'portable',state:'running'}),'Preparing portable download');
 assert.equal(f(null),'Idle');
});
test('operations queue is reachable independent of a running installation',()=>{
 for(const id of ['queueNavButton','queueToolbarButton','queueDockOpen','queueViewButton','queueDialog','queueMetricActive','queueMetricWaiting','queueMetricIssues'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(app,/\$\('queueToolbarButton'\)\.addEventListener\('click',openQueue\)/);
 assert.match(app,/\$\('queueNavButton'\)\.addEventListener/);
 assert.match(html,/id="queueProgress"[^>]*aria-valuetext=/);
 assert.doesNotMatch(html,/aria-valuenow/);
});
test('queued and active applications use separate border semantics',()=>{
 assert.match(app,/data-job="/);
 assert.match(css,/\.app-card\[data-job="active"\]::after/);
 assert.match(css,/\.app-card\[data-job="queued"\]::after/);
 assert.match(css,/\.app-card\[data-job="queued"\]::after\{border-style:dashed/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('scanner warning acknowledgement does not erase operational history',()=>{
 assert.match(app,/noticeDismissedKey/);
 assert.match(app,/queueDismissedFailure/);
 assert.match(app,/queueErrors\(\)/);
 assert.match(app,/Past failure · recovered/);
});
test('unverified new research candidates never gain installation approval',()=>{
 const reg=JSON.parse(fs.readFileSync(path.join(root,'challengers.json'),'utf8'));
 const rows=reg.projects.filter(p=>p.reviewStatus==='research-candidate-unverified');
 assert.equal(reg.projects.length,152);assert.equal(rows.length,73);
 for(const p of rows){assert.equal(p.installable,false);assert.equal(p.installAdapter,null);assert.equal(p.verifiedAt,null)}
});
