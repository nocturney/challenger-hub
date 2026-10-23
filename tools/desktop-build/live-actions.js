'use strict';
/* Native desktop Focus 4.0 control layer. Uses only existing approved backend routes. */
function focusActions(app){
 const safe=esc,repo=safe(app.repo);
 const button=(op,title)=>'<button type="button" class="focus-action" data-operation="'+op+
  '" data-repo="'+repo+'">'+title+'</button>';
 if(app.researchPendingVerification)return '<p class="focus-action-caveat">Unverified research project. Installation is disabled.</p>';
 const parts=[],installed=!!app.installedVersion;
 if(installed)parts.push(button('launch','Open installed app'));
 if(app.needsUpdate&&app.installable)parts.push(button('install','Update verified app'));
 else if(!installed&&app.installable)parts.push(button('install','Install verified app'));
 if(!installed&&app.downloadablePortable)parts.push(button('download-portable','Download verified portable'));
 if(!parts.length)parts.push('<p class="focus-action-caveat">No vetted installer for this app on this computer.</p>');
 if(snapshot?.platform==='win32'&&!snapshot.admin&&app.installable){
  return '<div class="focus-action-group"><p class="focus-action-caveat">Windows requires administrator permission to install or update.</p>'+
   button('elevate','Restart with administrator approval')+
   (installed?button('launch','Open installed app'):'')+'</div>';
 }
 return '<div class="focus-action-group">'+parts.join('')+'</div>';
}
function focusNotice(message,error=false){
 const n=document.getElementById('operationNotice');if(!n)return;
 n.hidden=false;n.textContent=message;n.className=error?'focus-operation-notice error':'focus-operation-notice';
 n.setAttribute('role',error?'alert':'status');
}
function focusToolbar(){
 const toolbar=document.getElementById('liveToolbar');if(!toolbar)return;
 const online=!!snapshot,scanning=!!snapshot?.sourceStatus?.scanning;
 const pending=projects.filter(a=>a.installable&&a.needsUpdate);
 const update=document.getElementById('focusUpdateAll');
 if(update){update.hidden=!pending.length;update.textContent='Update '+pending.length+' verified app'+(pending.length===1?'':'s')}
 toolbar.querySelectorAll('button[data-operation]').forEach(b=>{
  b.disabled=!online||(b.dataset.operation==='scan'&&scanning);
 });
 document.getElementById('focusStatus').textContent=!online?'Local engine unavailable':
  scanning?'Checking sources via network…':
  'Connected to '+(snapshot.computer||'this computer')+' · '+projects.filter(a=>a.installedVersion).length+' detected installs';
}
function focusConfirm(op,repo){
 const a=projectById.get(repo);
 if(['install','launch','download-portable'].includes(op)&&!a)throw Error('Unknown application');
 if(op==='install'){
  if(!a.installable||a.researchPendingVerification)throw Error('This app is not an approved install');
  if(snapshot?.platform==='win32'&&!snapshot.admin)throw Error('Administrator permission required');
  return window.confirm('Queue '+(a.needsUpdate?'an update for ':'installation of ')+a.title+
   '?\n\nThe vetted installer downloads a verified package and may modify this computer.');
 }
 if(op==='update-all'){
  const list=projects.filter(p=>p.installable&&p.needsUpdate);
  if(!list.length)throw Error('No approved updates pending');
  if(snapshot?.platform==='win32'&&!snapshot.admin)throw Error('Administrator permission required');
  return window.confirm('Update '+list.length+' approved apps?\n'+list.map(p=>'• '+p.title).join('\n')+
   '\n\nEach approved worker will execute in sequence.');
 }
 if(op==='scan')return window.confirm('Run a real network source scan? It may take time.');
 if(op==='download-portable')return !!a.downloadablePortable&&window.confirm(
  'Download an SHA-256-verified portable release of '+a.title+'? This does not install it.');
 return true;
}
async function runFocusOperation(button){
 const op=button?.dataset?.operation,repo=button?.dataset?.repo||'';
 const map={scan:'scan',verify:'verify',install:'install','download-portable':'download-portable',launch:'launch','update-all':'update-all'};
 if(!snapshot){focusNotice('Local engine unavailable',true);return}
 if(op==='elevate'){
  if(snapshot.platform!=='win32')return;
  if(!confirm('Restart this app as administrator? Windows will request UAC approval.'))return;
  if(window.chrome?.webview)window.chrome.webview.postMessage({type:'elevate-restart'});
  else focusNotice('Elevation is only supported in the Windows desktop application.',true);
  return;
 }
 if(!map[op])return;
 try{
  if(!focusConfirm(op,repo))return;
  button.disabled=true;focusNotice('Requesting '+op.replaceAll('-',' ')+' from the local engine…');
  try{
   if(op==='launch'&&snapshot?.platform==='win32'&&window.chrome?.webview){
    window.chrome.webview.postMessage({type:'launch',repo});
    focusNotice('Asking Windows to open '+(projectById.get(repo)?.title||repo)+'…');
    return;
   }
   const headers={'Content-Type':'application/json','X-Requested-With':'CraftUpdateCenter'};
   if(window.CHALLENGER_DESKTOP_SESSION)headers['X-Challenger-Desktop-Session']=window.CHALLENGER_DESKTOP_SESSION;
   const response=await fetch('/api/'+map[op],{
    method:'POST',headers,body:JSON.stringify(repo?{repo}:{})
   });
   const body=await response.json().catch(()=>({}));
   if(!response.ok||body.ok===false)throw Error(body.error||'HTTP '+response.status);
   if(op==='install'&&(!Array.isArray(body.queued)||!body.queued.includes(repo)))
    throw Error('Installation not accepted by the approved worker');
   focusNotice(op==='install'?'Approved installation/update queued: '+repo:
    op==='update-all'?'Approved updates queued: '+(body.queued||[]).length:
    op==='scan'?'Network scan requested. Progress appears in Activity.':
    op==='download-portable'?'Verified portable download started.':
    op==='launch'?'Local application open requested.':'Installed-software detection refreshed.');
   await refresh();
  }finally{button.disabled=false}
 }catch(e){focusNotice('Action rejected: '+String(e.message||e),true)}
}
if(window.chrome?.webview)window.chrome.webview.addEventListener('message',event=>{
 const result=event.data;
 if(result?.type==='launch-result')focusNotice(result.ok?
  'Windows opened '+(projectById.get(result.repo)?.title||result.repo)+'.':
  'Windows could not open this app: '+String(result.error||'Not installed or location untrusted'),!result.ok);
});
setInterval(()=>{if(!document.hidden&&snapshot&&['activity','library','project'].includes(ui.screen))
 void refresh()},6500);
