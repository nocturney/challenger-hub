// One-shot, read-only JSON IPC for the Rust/Slint host. No Slint Node addon is loaded.
import { readFromRealEngine } from './live-catalog.mjs';

try {
  const opts = {};
  if (process.env.CHALLENGER_PREVIEW_RUNTIME)
    opts.runtime = process.env.CHALLENGER_PREVIEW_RUNTIME;
  if (process.env.CHALLENGER_RESEARCH_SEED)
    opts.candidateFilePath = process.env.CHALLENGER_RESEARCH_SEED;
  const data = await readFromRealEngine(opts);
  process.stdout.write(JSON.stringify({schema:'challenger.native.catalog.v1', ...data})+'\n');
} catch (error) {
  console.error('CHALLENGER_SIDECAR_FAILED '+String(error?.stack||error));
  process.exitCode = 1;
}
