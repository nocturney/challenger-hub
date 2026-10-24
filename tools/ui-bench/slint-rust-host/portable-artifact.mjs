#!/usr/bin/env node
// CI-only, no downloads, installation, signing, or release publication.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createReadStream, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const stage = join(here, 'dist', 'ci-download');
const [mode, platform, archiveArgument] = process.argv.slice(2);
const platforms = new Set(['macos-arm64', 'macos-x86_64', 'windows-x64']);

function requireValue(value, pattern, name) {
  if (!value || !pattern.test(value)) throw new Error('Invalid or missing ' + name);
  return value;
}
function appVersion() {
  const lines = readFileSync(join(here, 'Cargo.toml'), 'utf8').split(/\r?\n/);
  const start = lines.indexOf('[package]');
  if (start < 0) throw new Error('Missing Rust package metadata');
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('['); i++) {
    const match = /^version\s*=\s*"([0-9]+\.[0-9]+\.[0-9]+)"\s*$/.exec(lines[i]);
    if (match) return match[1];
  }
  throw new Error('Missing semantic package version');
}
async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
async function main() {
  if (!platforms.has(platform)) throw new Error('Unexpected target platform');
  const sha = requireValue(process.env.GITHUB_SHA, /^[a-f0-9]{40}$/, 'GITHUB_SHA');
  const version = appVersion();
  const name = 'ChallengerHubNativePreview-v' + version + '-preview12-' +
    platform + '-' + sha.slice(0, 12) + '.zip';
  if (mode === 'name' && !archiveArgument) {
    process.stdout.write(name + '\n');
    return;
  }
  if (mode !== 'write' || !archiveArgument || process.argv.length !== 5) {
    throw new Error('Usage: portable-artifact.mjs name PLATFORM | write PLATFORM ARCHIVE');
  }
  if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('CI-only artifact writer');
  const repository = requireValue(process.env.GITHUB_REPOSITORY,
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'GITHUB_REPOSITORY');
  const runId = requireValue(process.env.GITHUB_RUN_ID, /^[0-9]+$/, 'GITHUB_RUN_ID');
  const headSha = requireValue(process.env.GITHUB_PR_HEAD_SHA,
    /^[a-f0-9]{40}$/, 'GITHUB_PR_HEAD_SHA');
  const archive = resolve(archiveArgument);
  if (dirname(archive) !== resolve(stage) || basename(archive) !== name) {
    throw new Error('Archive path or version does not match CI staging directory');
  }
  const checkedOut = execFileSync('git', ['rev-parse', 'HEAD'],
    { encoding: 'utf8' }).trim();
  if (checkedOut !== sha) throw new Error('Git checkout differs from workflow SHA');
  const nodePath = platform.startsWith('macos-')
    ? join(here, 'dist', 'ChallengerHubNativePreview.app', 'Contents', 'Resources', 'node')
    : join(here, 'dist', 'ChallengerHubNativePreview-Win', 'resources', 'node.exe');
  const noticePath = platform.startsWith('macos-')
    ? join(here, 'dist', 'ChallengerHubNativePreview.app', 'Contents', 'Resources', 'NODE_LICENSE.txt')
    : join(here, 'dist', 'ChallengerHubNativePreview-Win', 'resources', 'NODE_LICENSE.txt');
  const nodeVersion = execFileSync(nodePath, ['--version'],
    { encoding: 'utf8' }).trim();
  if (nodeVersion !== 'v24.22.1' || statSync(noticePath).size < 150000) {
    throw new Error('Bundled Node version or required license mismatch');
  }
  const archiveStat = statSync(archive);
  if (!archiveStat.isFile() || archiveStat.size < 1000) {
    throw new Error('Portable ZIP missing or unexpectedly empty');
  }
  const archiveHash = await sha256(archive);
  const nodeHash = await sha256(nodePath);
  const runUrl = 'https://github.com/' + repository + '/actions/runs/' + runId;
  const manifest = {
    schema: 'challenger.portable.build.v1',
    product: 'Challenger Native Preview',
    channel: 'temporary-developer-preview',
    appVersion: version,
    engine: 'Preview12 read-only',
    platform,
    buildProfile: 'release',
    repository,
    checkoutCommit: sha,
    pullRequestHeadCommit: headSha,
    gitRef: process.env.GITHUB_REF || '',
    runId,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || '1',
    runUrl,
    builtAtUtc: new Date().toISOString(),
    bundledNodeVersion: nodeVersion,
    bundledNodeSha256: nodeHash,
    archiveFilename: name,
    archiveSizeBytes: archiveStat.size,
    archiveSha256: archiveHash,
    macOSSigning: platform.startsWith('macos-') ? 'ad-hoc; not notarized' : 'not applicable',
    windowsSigning: platform === 'windows-x64' ? 'unsigned developer preview' : 'not applicable',
    noUserInstallation: true,
    publicRelease: false
  };
  writeFileSync(join(stage, 'BUILD_INFO.json'), JSON.stringify(manifest, null, 2) + '\n',
    { encoding: 'utf8', flag: 'wx' });
  writeFileSync(join(stage, 'SHA256SUMS.txt'), archiveHash + '  ' + name + '\n',
    { encoding: 'utf8', flag: 'wx' });
  const readme = [
    'CHALLENGER NATIVE PREVIEW - TEMPORARY DEVELOPER DOWNLOAD',
    '',
    'This is not a public release, production update, installer, or signed distributor build.',
    'Source: ' + repository + '  checkout=' + sha,
    'PR head: ' + headSha,
    'Build and tests: ' + runUrl,
    'Target: ' + platform + ', Preview12, bundled Node ' + nodeVersion,
    '',
    '1. Extract the GitHub Actions artifact ZIP. The portable application is the inner ZIP.',
    '2. Before opening the inner ZIP, compare its SHA-256 with SHA256SUMS.txt.',
    '   macOS: shasum -a 256 ' + name,
    '   Windows: Get-FileHash -Algorithm SHA256 ' + name,
    '3. Optional signed GitHub build provenance verification:',
    '   gh attestation verify ' + name + ' --repo ' + repository,
    '4. Extract the inner ZIP. Nothing is installed automatically.',
    '',
    'macOS: ad-hoc development signature only; no Apple notarization or Developer ID.',
    'Windows: unsigned; operating system trust warnings may occur.',
    'Do not disable Gatekeeper, SmartScreen, or other security protections automatically.',
    'The repository is public; these temporary Actions artifacts must not contain secrets.',
    'Do not redistribute this developer preview as a public, production-ready installer.',
    ''
  ].join('\n');
  writeFileSync(join(stage, 'READ_ME_FIRST.txt'), readme,
    { encoding: 'utf8', flag: 'wx' });
  process.stdout.write('PORTABLE_ARTIFACT_MANIFEST_PASS platform=' +
    platform + ' sha256=' + archiveHash + ' version=' + version + '\n');
}
main().catch((error) => {
  console.error('PORTABLE_ARTIFACT_MANIFEST_FAIL: ' + error.message);
  process.exitCode = 1;
});
