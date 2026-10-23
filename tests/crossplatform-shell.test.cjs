'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const policy=require('../tools/crossplatform-electron/shell-policy.cjs');
test('browser loads only owned loopback origin',()=>{
 assert.equal(policy.loopback('http://127.0.0.1:34567/api/state',34567),true);
 for(const url of [
  'http://localhost:34567/','http://127.0.0.1:34568/','https://127.0.0.1:34567/',
  'http://127.0.0.1.evil.net:34567/','file:///etc/passwd','javascript:alert(1)',
  'http://evil.net/#127.0.0.1:34567','http://attacker@127.0.0.1:34567'
 ])assert.equal(policy.loopback(url,34567),false,url);
});
test('external links require HTTPS and public host, not local services',()=>{
 for(const url of ['https://github.com/a/repo','https://example.org/tool'])
  assert.equal(policy.safeExternal(url),true,url);
 for(const url of ['http://github.com','file:///etc/passwd','https://127.0.0.1',
   'https://localhost/foo','https://router.local/config',
   'https://name:password@example.com','https://[::1]','javascript:open()'])
  assert.equal(policy.safeExternal(url),false,url);
});
test('profile is separate from existing Preview11 or production',()=>{
 const p=policy.deploymentRoot('/tmp/challenger-tests');
 assert.match(p,/CrossPlatformPilot12$/);
 assert.doesNotMatch(p,/Preview11/);
});
test('bundled media and source integrity is verified',()=>{
 const p=path.resolve(__dirname,'../tools/desktop-build/dist/runtime-preview12');
 if(!fs.existsSync(p))return;
 const proof=policy.verifyBundled(p);
 assert.equal(proof.version,'4.0.0-desktop.preview.12');
 assert.ok(proof.files>=100);
 assert.equal(policy.verifyExisting(p,p),true);
});
