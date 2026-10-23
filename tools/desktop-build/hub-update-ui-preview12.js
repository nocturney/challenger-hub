'use strict';
/* Desktop self-update control: read-only official GitHub release checks. Never installs. */
(function(){
 const $=id=>document.getElementById(id);
 const button=$('hubCheckUpdates'),status=$('hubUpdateState'),link=$('hubUpdateLink'),version=$('hubVersion');
 if(!button||!status||!link||!version)return;
 const preview='12',tag='v4.0.0-orbit-preview.'+preview;
 version.textContent='v4.0.0 · Preview '+preview;
 version.setAttribute('title','Running '+tag+' (Windows x64 test channel)');
 let last=null,busy=false;
 async function check(manual=false){
  if(busy)return;
  busy=true;button.disabled=true;status.textContent='Checking Hub releases…';
  try{
   const res=await fetch('/api/hub-update'+(manual?'?force=1':''),{cache:'no-store'});
   const data=await res.json();
   last=data;link.hidden=true;link.removeAttribute('href');
   if(!res.ok||!data.ok)throw Error(data.error||'GitHub release check unavailable');
   if(data.currentTag!==tag)throw Error('Version identity mismatch: '+data.currentTag);
   if(data.updateAvailable){
    const u=data.upgrade;
    if(!u||!/^v4\.0\.0-orbit-preview\.[0-9]+$/.test(u.tag)||!/^https:\/\/github\.com\/nocturney\/challenger-hub\/releases\/tag\/v4\.0\.0-orbit-preview\.[0-9]+$/.test(u.releaseUrl))
     throw Error('Untrusted self-update link');
    status.textContent='Preview '+u.preview+' available';
    link.href=u.releaseUrl;link.textContent='View verified release ↗';link.hidden=false;
    button.textContent='Open Preview '+u.preview;
    button.title='Open official GitHub Release to inspect and download Preview '+u.preview;
    status.classList.add('new');
   }else{
    status.textContent='';
    button.textContent='Check updates';button.title='Check updates for Challenger Hub itself';
    status.classList.remove('new');
   }
  }catch(e){
   button.textContent='Check updates';button.title='Check updates for Challenger Hub itself';
   status.textContent='Hub update check unavailable';
   status.title=String(e.message||e);
   status.classList.remove('new');link.hidden=true;
  }finally{
   if(manual&&typeof focusNotice==='function')focusNotice(!last?.ok?'Hub release check unavailable':last.updateAvailable?status.textContent:'No newer release available',!last?.ok);
   busy=false;button.disabled=false;
  }
 }
 button.addEventListener('click',()=>{
  if(last?.ok&&last.updateAvailable&&!link.hidden&&/^https:\/\/github\.com\/nocturney\/challenger-hub\/releases\/tag\/v4\.0\.0-orbit-preview\.[0-9]+$/.test(link.href))
   window.open(link.href,'_blank','noopener,noreferrer');
  else void check(true);
 });
 // Manual checks only: no constant footer status or unnecessary startup API refresh.
})();
