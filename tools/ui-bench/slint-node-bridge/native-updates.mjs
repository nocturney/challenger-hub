// Manual, bounded, read-only checks for a *native* Challenger release.
// Preview12 web/Windows installers are intentionally NOT upgrade candidates.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const BASE = 'https://github.com/nocturney/challenger-hub';
const API = 'https://api.github.com/repos/nocturney/challenger-hub/releases?per_page=10';
const MAX_BYTES = 2_000_000;
export const SCHEMA = 'challenger.native.updates.v1';
const TAG = /^native-v(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function versionOf(text) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(text));
  return m ? m.slice(1).map(Number) : null;
}
function newer(a, b) {
  for (let i=0;i<3;i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return false;
}
export function assetFor(platform, arch) {
  const names = {
    'darwin:arm64': 'ChallengerHubNativePreview-macOS-arm64.zip',
    'darwin:x64': 'ChallengerHubNativePreview-macOS-x64.zip',
    'win32:x64': 'ChallengerHubNativePreview-Windows-x64.zip',
    'linux:x64': 'ChallengerHubNativePreview-Linux-x64.tar.gz',
  };
  return names[platform + ':' + arch] ?? null;
}
export function selectRelease(releases, {platform, arch, version}) {
  if (!Array.isArray(releases) || !versionOf(version)) return {status:'unavailable'};
  const name=assetFor(platform,arch);
  if (!name) return {status:'unsupported'};
  let candidate=null;
  for (const r of releases.slice(0, 10)) {
    const match=TAG.exec(r?.tag_name ?? '');
    if (!match || r.draft) continue;
    const ver=match.slice(1).map(Number);
    const asset=r.assets?.find(a=>a.name===name);
    const url=BASE+'/releases/download/'+r.tag_name+'/'+name;
    // A GitHub hosted asset with a platform-specific name and SHA-256 is
    // required. No unverified Preview12 asset is a native update.
    if (!asset || asset.browser_download_url !== url ||
        !/^sha256:[a-f0-9]{64}$/i.test(asset.digest ?? '') ||
        asset.size < 1_000_000 || asset.size > 500_000_000) continue;
    const next={version:ver.join('.'),url:BASE+'/releases/tag/'+r.tag_name};
    if (!candidate || newer(ver, versionOf(candidate.version))) candidate=next;
  }
  if (!candidate) return {status:'not-published'};
  return newer(versionOf(candidate.version),versionOf(version))
    ? {status:'available', ...candidate}
    : {status:'current', ...candidate};
}
async function officialReleases() {
  const response=await fetch(API,{
    headers:{Accept:'application/vnd.github+json','User-Agent':'ChallengerNativeManualCheck/1.0'},
    signal:AbortSignal.timeout(12000), redirect:'error',
  });
  if (!response.ok) throw Error('Official GitHub releases unavailable');
  const reader=response.body.getReader();
  let total=0; const chunks=[];
  try {
    for (;;) {
      const {done,value}=await reader.read();
      if (done) break;
      total+=value.byteLength;
      if (total > MAX_BYTES) throw Error('Response exceeds size limit');
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function manualCheck({
  platform=process.platform,arch=process.arch,
  version=process.env.CHALLENGER_NATIVE_VERSION ?? '0.1.0',
  fetcher=officialReleases,
}={}) {
  try {
    const selected=selectRelease(await fetcher(),{platform,arch,version});
    return {schema:SCHEMA,manual:true,automaticInstallation:false,
      source:BASE+'/releases',status:selected.status,
      releaseUrl:selected.url ?? null,
      releaseVersion:selected.version ?? null};
  } catch (_) {
    return {schema:SCHEMA,manual:true,automaticInstallation:false,
      source:BASE+'/releases',status:'error',releaseUrl:null,releaseVersion:null};
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result=await manualCheck();
  process.stdout.write(JSON.stringify(result)+'\n');
}
