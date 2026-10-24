// End-to-end cooperative cancellation probe, isolated GitHub Windows CI only.
// Invoke after a verified SolveSpace install; never on a real user workstation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const temp=process.env.RUNNER_TEMP||'';
const local=process.env.LOCALAPPDATA||'';
assert(process.platform==='win32' &&
  process.env.GITHUB_ACTIONS==='true' &&
  process.env.RUNNER_OS==='Windows' &&
  process.env.GITHUB_RUN_ID && temp && local &&
  path.resolve(local).toLowerCase().startsWith(
    path.resolve(temp).toLowerCase()+path.sep.toLowerCase()),
  'Refuse cooperative cancel QA outside disposable GitHub Windows runner');
const token=process.argv[2];
assert(/^[a-f0-9]{64}$/i.test(token||''),'Missing approved fixture token');
const bridge=path.join(path.dirname(fileURLToPath(import.meta.url)),'install-bridge.mjs');
assert(fs.existsSync(bridge),'Missing native install bridge');
const child=spawn(process.execPath,[bridge,'install','curated:solvespace',token],{
  stdio:['pipe','pipe','pipe'],windowsHide:true,
  env:{...process.env,CHALLENGER_CI_CANCEL_GATE:'1'}
});
child.stdin.on('error',()=>{});
let buffer='',stderr='',sawReady=false,sawCanceled=false,sawSuccess=false;
child.stdout.setEncoding('utf8');
child.stdout.on('data',chunk=>{
  buffer+=chunk;
  if(buffer.length>30000)buffer=buffer.slice(-30000);
  let idx;
  while((idx=buffer.indexOf('\n'))>=0){
    const line=buffer.slice(0,idx);buffer=buffer.slice(idx+1);
    try{
      const outer=JSON.parse(line);
      if(outer.schema==='challenger.native.install-result.v1' && outer.state==='success')
        sawSuccess=true;
      if(outer.state!=='worker')continue;
      const inner=JSON.parse(outer.detail);
      if(inner.state==='cancel-ready'&&!sawReady){
        sawReady=true;
        child.stdin.write('cancel\n');
      }
      if(inner.state==='cancelled')sawCanceled=true;
    }catch{}
  }
});
child.stderr.setEncoding('utf8');
child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-5000)});
let timeout;
const code=await Promise.race([
  new Promise((resolve,reject)=>{
    child.once('close',resolve);
    child.once('error',reject);
  }),
  new Promise((_,reject)=>{
    timeout=setTimeout(()=>{child.kill();reject(Error('Cooperative cancel CI timeout'))},25000);
  })
]).finally(()=>clearTimeout(timeout));
assert.notEqual(code,0,'Worker unexpectedly succeeded after explicit cancellation');
assert(sawReady,'No real worker reached the cancellation barrier');
assert(sawCanceled,'Worker did not confirm cancellation before swapping files');
assert(!sawSuccess,'Native bridge falsely issued a verified install completion');
assert(stderr.includes('INSTALL_CANCELLED_BEFORE_COMMIT'),
  'Native bridge did not report a verified safe cancel: '+stderr.slice(-800));
console.log('NATIVE_COOPERATIVE_CANCEL_PASS '+JSON.stringify({
  workerReached:true,cancelRequested:true,confirmedBeforeCommit:true,
  falseSuccess:false,disposableWindowsRunner:true
}));
