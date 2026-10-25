#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const read = rel => readFileSync(join(dir, rel), 'utf8');
const token = read('ui/quiet-premium.slint');
const card = read('ui/catalog-card.slint');
const identity = read('ui/identity-card.slint');
const focus = read('ui/focus.slint');
const host = read('src/main.rs');
function requireGate(ok, why) { if (!ok) throw Error('RICH_MINIMALISM_FAIL: ' + why); }
for (const value of ['card-radius','control-radius','hover-motion','tab-motion',
    'light-hover','dark-hover','light-shadow','dark-shadow']) {
    requireGate(token.includes(value), 'Missing shared design token: ' + value);
}
for (const state of ['highlighted','hovered','pressed','reduced-motion']) {
    requireGate(card.includes('root.' + state), 'Card does not respond to ' + state);
}
requireGate(card.includes('animate background, border-color') &&
    card.includes('enabled: !root.reduced-motion'), 'Card motion not guarded');
requireGate(focus.includes('product-hit.has-hover') &&
    focus.includes('product-hit.pressed') &&
    focus.includes('product-focus.has-focus'), 'Interaction state regression');
requireGate(focus.includes('accessible-action-default => { root.open-project(i); }') &&
    focus.includes('root.open-project(i);'), 'Keyboard project action regression');
for (const name of ['discover-nav','browse-nav','library-nav','activity-nav','about-nav']) {
    requireGate(focus.includes(name + '.hovered') &&
        focus.includes(name + '.pressed'), 'Nav hover or press missing: ' + name);
}
requireGate((focus.match(/enabled: !root.reduced-motion;/g) || []).length >= 6,
    'Motion preference missing from navigation or disclosure');
requireGate(host.includes('set_reduced_motion(reduced_motion_requested())') &&
    host.includes('CHALLENGER_REDUCED_MOTION') &&
    host.includes('SPI_GETCLIENTAREAANIMATION'), 'Host preference wiring missing');
requireGate(card.includes('ApprovedGalleryThumb') && card.includes('IdentityTile') &&
    !/Image\s*\{|@image-url|monogram|crafted preview/i.test(card),
    'Card media must be official or factual identity only');
requireGate(!/Image\s*\{|@image-url|monogram|mockup/i.test(identity),
    'Identity artwork policy regression');
console.log('RICH_MINIMALISM_GATE_PASS tokens=shared hover=on focus=preserved motion=guarded media=truthful');
