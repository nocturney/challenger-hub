'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parse,parseFeed,latest}=require('../platform/shared/Resolve-CraftRelease');
const feed=(repo,versions)=>'<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><id>tag:github.com,2008:https://github.com/storytold/'+repo+'/releases</id>'+versions.map(t=>'<entry><link href="https://github.com/storytold/'+repo+'/releases/tag/'+t+'"/></entry>').join('')+'</feed>';
const response=(body,status=200,headers={})=>new Response(body,{status,headers});
test('accepts only the approved official release path',()=>{
 assert.equal(parse('cadcraft','https://github.com/storytold/cadcraft/releases/tag/v0.4.0'),'v0.4.0');
 assert.throws(()=>parse('cadcraft','https://github.com/attacker/cadcraft/releases/tag/v0.4.0'),/approved GitHub/);
 assert.throws(()=>parse('cadcraft','https://github.com/storytold/cadcraft/releases/tag/%2Fbad'),/Unsafe/);
});
test('normal GitHub latest-release redirect takes precedence',async()=>{
 const calls=[];
 const tag=await latest('cadcraft',async url=>{
  calls.push(url);
  return response(null,302,{location:'https://github.com/storytold/cadcraft/releases/tag/v0.4.0'});
 });
 assert.equal(tag,'v0.4.0');assert.equal(calls.length,1);
});
test('GitHub 403 recovers via official Atom, skipping prereleases',async()=>{
 const calls=[];
 const tag=await latest('wordcraft',async url=>{
  calls.push(url);
  if(url.endsWith('/releases/latest'))return response(null,403);
  return response(feed('wordcraft',['v0.5.0-beta.2','v0.4.0']),200,{'content-type':'application/atom+xml; charset=utf-8'});
 });
 assert.equal(tag,'v0.4.0');assert.equal(calls.length,2);
});
test('Atom feed does not permit identity substitution',()=>{
 assert.throws(()=>parseFeed('wordcraft',feed('cadcraft',['v9.0.0'])),/identity mismatch/);
});
test('Atom feed rejects prerelease-only entries',()=>{
 assert.throws(()=>parseFeed('wordcraft',feed('wordcraft',['v1.0.0-alpha.1','v1.1.0-rc.2'])),/No stable/);
});
test('requests do not fall back to untrusted HTML',async()=>{
 await assert.rejects(()=>latest('wordcraft',async url=>url.endsWith('/releases/latest')?response(null,403):response('<html>danger</html>',200,{'content-type':'text/html'})),/Official release verification unavailable/);
});
test('unlisted software cannot resolve official releases',async()=>{
 await assert.rejects(()=>latest('unapproved-test',async()=>response(null,302,{location:'https://github.com/storytold/cadcraft/releases/tag/v9.0.0'})),/Unapproved Craft/);
});
