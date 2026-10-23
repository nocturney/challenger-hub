'use strict';
/*
 * Three native desktop renderers, one source snapshot, one host.
 * Samples startup-to-first-ready and process-tree aggregate resident memory.
 * Limitations: ready signals are after 2 RAFs for WebView, timer-based in Slint;
 * summed RSS double-counts shared pages, and Electron carries Chromium while
 * Tauri uses the system WebKit. Thus these are directional, NOT scientific
 * cross-engine first-paint timings.
 */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),
 cp=require('node:child_process'),crypto=require('node:crypto'),{performance}=require('node:perf_hooks');
const root=__dirname,results=path.join(root,'results');
const electronRoot=path.join(root,'electron'),
 electronPath=require(path.join(electronRoot,'node_modules','electron'));
const projects={
 electron:{exec:electronPath,args:['.','--bench-smoke'],cwd:electronRoot,processRoot:electronPath},
 tauri:{exec:path.join(root,'tauri','src-tauri','target','release','challenger-tauri-bench'),
  args:['--bench-smoke'],cwd:root},
 slint:{exec:path.join(root,'slint','target','release','challenger-native-bench'),
  args:['--bench-smoke'],cwd:root}
};
const sha=crypto.createHash('sha256').update(JSON.stringify(JSON.parse(fs.readFileSync(path.join(root,'data','challenger181.json')))))
 .digest('hex');
function psTree(pid){
 const text=cp.execFileSync('ps',['-Ao','pid=,ppid=,rss=,%cpu='],{encoding:'utf8'});
 const rows=text.trim().split('\n').map(s=>s.trim().split(/\s+/).map(Number))
  .filter(x=>x.length===4&&Number.isFinite(x[0]));
 const found=new Set([pid]);for(let round=0;round<20;round++){
  let changed=false;for(const row of rows)if(found.has(row[1])&&!found.has(row[0])){
   found.add(row[0]);changed=true;
  }if(!changed)break;
 }
 let rss=0,cpu=0;for(const [p,_pp,kb,percent] of rows)if(found.has(p)){rss+=kb;cpu+=percent}
 return {processes:found.size,aggregateRssMiB:Math.round(rss/1024*10)/10,
  snapshotCpuPercent:Math.round(cpu*10)/10};
}
function median(a){let b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)]}
async function one(name,trial){
 const p=projects[name];
 if(!fs.existsSync(p.exec))throw Error(name+' binary missing '+p.exec);
 const start=performance.now(),child=cp.spawn(p.exec,p.args,{cwd:p.cwd,stdio:['ignore','pipe','pipe'],
  env:{...process.env,CHALLENGER_BENCH:'1'}});
 let log='',finished=false,ready=null,exitCode=null;
 const result=new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error(name+' timed out; '+log.slice(-1500))),45000);
  const inspect=()=>{
   if(ready)return;
   const match=log.match(/BENCH_READY framework=(\S+) total=(\d+) renderer=(\S+) ms_since_main=(\d+)/);
   if(match){
    ready={framework:match[1],total:Number(match[2]),renderer:match[3],
     appReadyMs:Number(match[4]),startToReadyMs:Math.round(performance.now()-start)};
    if(ready.total!==181){clearTimeout(timeout);reject(Error('Wrong catalog count '+name));return}
    setTimeout(()=>{
     try{
      const mem=psTree(child.pid);
      clearTimeout(timeout);
      resolve({...ready,...mem,trial,pid:child.pid});
     }catch(e){clearTimeout(timeout);reject(e)}
    },240);
   }
  };
  for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{
   log+=b.toString().slice(0,1700);if(log.length>12000)log=log.slice(-12000);inspect();
  });
  child.on('error',e=>{clearTimeout(timeout);reject(e)});
  child.on('close',code=>{
   exitCode=code;finished=true;
   if(!ready){clearTimeout(timeout);reject(Error(name+' exited '+code+' without readiness: '+log.slice(-1800)))}
  });
 });
 try{return await result}
 finally{
  if(!finished){child.kill('SIGTERM');await new Promise(ok=>{
    let done=false;const finish=()=>{if(!done){done=true;ok()}};
    child.once('close',finish);setTimeout(()=>{try{child.kill('SIGKILL')}catch{};finish()},1500);
  })}
 }
}
async function main(){
 const suite={schema:'challenger-ui-renderer-benchmark.v1',createdAt:new Date().toISOString(),
  os:process.platform,arch:process.arch,cpuCores:os.cpus().length,fixtureCount:181,
  fixtureHash:sha,
  caveats:['Same source records but not identical rendering work (Slint list virtualization vs DOM full grid).',
   'Ready signals measure different milestones (Slint timer vs WebView two animation frames).',
   'Aggregate RSS includes helper processes and shared pages; Tauri uses system WebKit.',
   'No installed application backend, installer or real DCC workloads are included.'],
  runs:[],summary:{}};
 const trials=Number(process.argv[2]||3);
 if(!Number.isInteger(trials)||trials<1||trials>5)throw Error('trials 1..5');
 for(let i=0;i<trials;i++){
  for(const name of ['electron','tauri','slint']){
   try{
    const sample=await one(name,i+1);suite.runs.push(sample);
    console.log('BENCH_SAMPLE '+JSON.stringify(sample));
   }catch(e){
    suite.runs.push({framework:name,trial:i+1,error:String(e.message).slice(0,800)});
    console.error('BENCH_ERROR '+name+': '+String(e.message));
   }
   await new Promise(ok=>setTimeout(ok,300));
  }
 }
 for(const name of ['electron','tauri','slint']){
  const rows=suite.runs.filter(r=>r.framework===name&&!r.error);
  suite.summary[name]=rows.length?{
   validTrials:rows.length,
   medianStartToReadyMs:median(rows.map(x=>x.startToReadyMs)),
   medianAppReadyMs:median(rows.map(x=>x.appReadyMs)),
   medianAggregateRssMiB:median(rows.map(x=>x.aggregateRssMiB)),
   processCountRange:[Math.min(...rows.map(x=>x.processes)),Math.max(...rows.map(x=>x.processes))]
  }:{validTrials:0};
 }
 const output=path.join(results,'benchmark-macos-arm64.json');
 fs.mkdirSync(results,{recursive:true});
 fs.writeFileSync(output,JSON.stringify(suite,null,2)+'\n');
 console.log('BENCHMARK_SUMMARY '+JSON.stringify(suite.summary));
 if(Object.values(suite.summary).some(x=>x.validTrials!==trials))process.exitCode=2;
}
main().catch(e=>{console.error('BENCHMARK_FAILED '+(e.stack||e));process.exitCode=2});
