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
for (const name of ['discover-nav','browse-nav','library-nav','activity-nav']) {
    requireGate(focus.includes(name + '.hovered') &&
        focus.includes(name + '.pressed'), 'Nav hover or press missing: ' + name);
}
requireGate((focus.match(/enabled: !root.reduced-motion;/g) || []).length >= 5,
    'Motion preference missing from navigation or disclosure');
requireGate(host.includes('update_preference_ui(&ui, &prefs, system_motion)') &&
    host.includes('CHALLENGER_REDUCED_MOTION') &&
    host.includes('SPI_GETCLIENTAREAANIMATION'), 'Host preference wiring missing');
requireGate(card.includes('ApprovedGalleryThumb') && card.includes('IdentityTile') &&
    !/Image\s*\{|@image-url|monogram|crafted preview/i.test(card),
    'Card media must be official or factual identity only');
requireGate(!/Image\s*\{|@image-url|monogram|mockup/i.test(identity),
    'Identity artwork policy regression');
// Layout regressions: Search must never be a bordered field inside a second field.
const home = focus.split('// DISCOVER / HOME:')[1]?.split('// Product-first browse:')[0] ?? '';
const browse = focus.split('// Product-first browse:')[1]?.split('// A full-page dossier,')[0] ?? '';
requireGate(home.includes('LineEdit {') && browse.includes('LineEdit {'),
    'Both Discover and Browse must have a native search input');
requireGate(!home.includes('Text { text: "SEARCH"') &&
    !browse.includes('Text { text: "SEARCH"'),
    'The nested search-label overlay was reintroduced');
requireGate(browse.includes('SEARCH SOFTWARE') &&
    browse.indexOf('SEARCH SOFTWARE') < browse.indexOf('LineEdit {') &&
    browse.includes('root.matching + " results"'),
    'Browse search label, input and results must align');
for (const fragment of ['padding-top: root.compact-layout ? 11px : 14px',
    'padding-left: root.compact-navigation ? 22px : 48px',
    'height: root.compact-layout ? 32px : 40px']) {
    requireGate(focus.includes(fragment), 'Brand header inset missing: ' + fragment);
}
requireGate(host.includes('--qa-preview-compact-results') &&
    host.includes('--qa-preview-dark-results'),
    'Native compact/dark layout QA routes missing');
requireGate(focus.includes('preferences-popup := PopupWindow') &&
    focus.includes('Palette.color-scheme =') &&
    focus.includes('AboutSlint { height: 118px;'),
    'Preferences popup, accessible native widget colors or official attribution missing');
requireGate(focus.includes('root.change-appearance("system")') &&
    focus.includes('root.change-motion("system")') &&
    focus.includes('root.change-contrast(true)') &&
    focus.includes('root.check-native-updates()'),
    'Preferences actions are not wired to native behavior');
console.log('RICH_MINIMALISM_GATE_PASS tokens=shared focus=preserved motion=guarded media=truthful preferences=native');
